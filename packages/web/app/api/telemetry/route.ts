import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

/**
 * Aggregate telemetry ingestion (TICKET-039). Stores COUNTS + scrubbed error
 * codes only — the strict shape below means no recipient data can be persisted
 * even if the client sent extra fields (SECURITY §5.6).
 *
 * Attribution is advisory (SECURITY §3.4): the extension's report is unverified,
 * so this is NEVER a money gate (billing state comes from webhooks). We attribute
 * by the sender's stable Google `sub` — the same key as web sign-in — so a user's
 * extension activity and dashboard line up.
 */
const clampInt = (v: unknown) => Math.max(0, Math.floor(Number(v) || 0));

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as {
    account?: { sub?: string | null; email?: string };
    campaign?: {
      campaignRef?: string;
      attempted?: number;
      sent?: number;
      failed?: number;
      capHits?: number;
      errorCodes?: string[];
      extVersion?: string;
    };
  } | null;

  const acc = body?.account;
  const c = body?.campaign;
  if (!acc || (!acc.sub && !acc.email)) return NextResponse.json({ error: 'missing account' }, { status: 400 });
  if (!c?.campaignRef) return NextResponse.json({ error: 'missing campaign' }, { status: 400 });

  const sub = String(acc.sub || `email:${acc.email}`);
  const email = String(acc.email ?? '');

  const user = await prisma.user.upsert({
    where: { googleSub: sub },
    update: { email, lastSeenAt: new Date() },
    create: { googleSub: sub, email, lastSeenAt: new Date() },
  });

  await prisma.campaignStat.upsert({
    where: { userId_campaignRef: { userId: user.id, campaignRef: String(c.campaignRef) } },
    update: { attempted: clampInt(c.attempted), sent: clampInt(c.sent), failed: clampInt(c.failed), capHits: clampInt(c.capHits) },
    create: {
      userId: user.id,
      campaignRef: String(c.campaignRef),
      attempted: clampInt(c.attempted),
      sent: clampInt(c.sent),
      failed: clampInt(c.failed),
      capHits: clampInt(c.capHits),
      startedAt: new Date(),
    },
  });

  // Distinct Gmail error reasons — codes only, capped; never messages/PII.
  const codes = Array.isArray(c.errorCodes) ? c.errorCodes.slice(0, 20).map((x) => String(x).slice(0, 80)) : [];
  if (codes.length) {
    await prisma.errorEvent.createMany({
      data: codes.map((code) => ({ userId: user.id, kind: 'send_error', message: code, extVersion: String(c.extVersion ?? '') })),
    });
  }

  return NextResponse.json({ ok: true });
}
