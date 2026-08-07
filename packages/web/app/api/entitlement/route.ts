import { NextResponse } from 'next/server';
import { entitlementFor, type PlanTier } from '@fanout/shared';
import { prisma } from '@/lib/prisma';
import { getSessionUser } from '@/lib/session';

/**
 * Returns the caller's plan entitlement (TICKET-040). Tier comes from the DB
 * `subscriptions` row, which is only ever written by verified Lemon Squeezy
 * webhooks (TICKET-041) — so plan can't be self-granted from the client.
 *
 * Identity: a signed-in web session (trustworthy) wins; otherwise the extension
 * may pass `?sub=` (advisory — SECURITY §3.4). At launch every tier unlocks
 * everything, so advisory attribution exposes nothing. HARDENING before paid
 * gating actually bites: the extension path needs a verified identity (ID token),
 * else `pro` could be spoofed by guessing a sub.
 */
export async function GET(req: Request) {
  const session = await getSessionUser();
  const sub = session?.sub ?? new URL(req.url).searchParams.get('sub') ?? undefined;

  if (!sub) return NextResponse.json(entitlementFor('free'));

  const user = await prisma.user.findUnique({
    where: { googleSub: sub },
    include: { subscription: true },
  });
  const tier = (user?.subscription?.plan as PlanTier) ?? 'free';
  return NextResponse.json(entitlementFor(tier));
}
