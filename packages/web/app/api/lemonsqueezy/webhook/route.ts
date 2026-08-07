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

  const payload = JSON.parse(raw) as {
    meta: { event_name: string; custom_data?: { user_sub?: string } };
    data: { id: string; attributes: Record<string, unknown> };
  };

  if (!payload.meta.event_name?.startsWith('subscription_')) {
    return NextResponse.json({ ok: true }); // ignore non-subscription events
  }

  const attrs = payload.data.attributes;
  const userSub = payload.meta.custom_data?.user_sub;
  const email = typeof attrs.user_email === 'string' ? attrs.user_email : undefined;

  // Attribute to our user by the custom sub (from checkout) or the billing email.
  const user = userSub
    ? await prisma.user.findUnique({ where: { googleSub: userSub } })
    : email
      ? await prisma.user.findFirst({ where: { email } })
      : null;
  if (!user) return NextResponse.json({ ok: true }); // nothing to attach to

  const status = mapStatus(String(attrs.status ?? ''));
  const plan = status === 'active' || status === 'trialing' ? 'pro' : 'free';
  const currentPeriodEnd = typeof attrs.renews_at === 'string' ? new Date(attrs.renews_at) : null;

  const fields = {
    provider: 'lemonsqueezy',
    providerCustomerId: String(attrs.customer_id ?? ''),
    providerSubscriptionId: String(payload.data.id),
    plan,
    status,
    currentPeriodEnd,
  } as const;

  await prisma.subscription.upsert({
    where: { userId: user.id },
    update: fields,
    create: { userId: user.id, ...fields },
  });

  return NextResponse.json({ ok: true });
}
