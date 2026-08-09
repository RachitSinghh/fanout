import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyWebhookSignature, mapStatus } from '@/lib/lemonsqueezy';

/**
 * Lemon Squeezy subscription webhook (TICKET-041). The SOLE source of truth for a
 * user's plan (SECURITY §3.2) — a client can never self-grant Pro. Verifies the
 * HMAC signature, then upserts the subscription. Upsert is idempotent, so a
 * re-delivered event just re-applies the same state (no double effect).
 */
export async function POST(req: Request) {
  const raw = await req.text();
  if (!verifyWebhookSignature(raw, req.headers.get('x-signature'))) {
    return NextResponse.json({ error: 'bad signature' }, { status: 401 });
  }

  type Payload = {
    meta: { event_name: string; custom_data?: { user_sub?: string } };
    data: { id: string; type: string; attributes: Record<string, unknown> };
  };
  const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null;

  // Validate the shape, not just the JSON syntax: a validly-signed `null` or a
  // payload missing `data`/`meta`/`attributes` would otherwise throw a 500 when
  // we read nested fields. An invalid schema is a client error (400).
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: 'bad payload' }, { status: 400 });
  }
  if (!isRecord(parsed) || !isRecord(parsed.meta) || !isRecord(parsed.data) || !isRecord(parsed.data.attributes)) {
    return NextResponse.json({ error: 'bad payload' }, { status: 400 });
  }
  const payload = parsed as Payload;

  // Only act on Subscription resources. `subscription_payment_*` events carry
  // INVOICE data (type 'subscription-invoices') with no subscription status —
  // processing them would wrongly downgrade a paying user.
  if (payload.data.type !== 'subscriptions') return NextResponse.json({ ok: true });

  const attrs = payload.data.attributes;
  const lsSub = String(payload.data.id);

  // Attribute ONLY by the sub we embed in checkout custom data. We never guess by
  // email — User.email is not unique, so email matching could grant Pro to the
  // wrong account. A subscription created outside our checkout (no user_sub) is
  // skipped rather than mis-attributed.
  const userSub = payload.meta.custom_data?.user_sub;
  if (!userSub) return NextResponse.json({ ok: true });
  const user = await prisma.user.findUnique({ where: { googleSub: userSub } });
  if (!user) return NextResponse.json({ ok: true });

  // Unknown/unexpected status → no-op (never downgrade on something we don't model).
  const status = String(attrs.status ?? '');
  const KNOWN = ['active', 'on_trial', 'past_due', 'cancelled', 'expired', 'unpaid', 'paused'];
  if (!KNOWN.includes(status)) return NextResponse.json({ ok: true });

  const endsAt = typeof attrs.ends_at === 'string' ? new Date(attrs.ends_at) : null;
  const renewsAt = typeof attrs.renews_at === 'string' ? new Date(attrs.renews_at) : null;
  const providerUpdatedAt = typeof attrs.updated_at === 'string' ? new Date(attrs.updated_at) : null;

  // Access is granted while active/trialing, through the dunning grace (past_due),
  // and after cancellation until the paid period actually ends.
  const grantsAccess =
    status === 'active' ||
    status === 'on_trial' ||
    status === 'past_due' ||
    (status === 'cancelled' && !!endsAt && endsAt.getTime() > Date.now());

  const existing = await prisma.subscription.findUnique({ where: { userId: user.id } });

  // Ordering / superseded-subscription guard for out-of-order and re-delivered
  // webhooks (both common). Every subscription event carries the provider's
  // updated_at; an event that isn't strictly newer than the one we last applied
  // can't carry newer truth. Two cases are stale:
  //   - a revoke for a DIFFERENT (superseded) subscription — never touch the current one;
  //   - any event (same or different sub) not newer than what we last applied.
  if (existing?.providerSubscriptionId) {
    const differentSub = existing.providerSubscriptionId !== lsSub;
    const notNewer =
      !!existing.providerUpdatedAt &&
      !!providerUpdatedAt &&
      providerUpdatedAt.getTime() <= existing.providerUpdatedAt.getTime();
    if ((differentSub && !grantsAccess) || notNewer) {
      return NextResponse.json({ ok: true });
    }
  }

  // Preserve an existing 'team' plan regardless of this event (team isn't sold via
  // these Pro variants yet, so a cancel/expire here must not strip it). Otherwise
  // grant 'pro' while access holds, or revoke to 'free'.
  const plan = existing?.plan === 'team' ? 'team' : grantsAccess ? 'pro' : 'free';

  const fields = {
    provider: 'lemonsqueezy',
    providerCustomerId: String(attrs.customer_id ?? ''),
    providerSubscriptionId: lsSub,
    providerUpdatedAt: providerUpdatedAt ?? existing?.providerUpdatedAt ?? null,
    plan,
    status: mapStatus(status),
    currentPeriodEnd: endsAt ?? renewsAt,
  } as const;

  await prisma.subscription.upsert({
    where: { userId: user.id },
    update: fields,
    create: { userId: user.id, ...fields },
  });

  return NextResponse.json({ ok: true });
}
