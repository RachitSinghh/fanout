import { entitlementFor, type PlanTier } from '@fanout/shared';
import { getSessionUser } from '@/lib/session';
import { prisma } from '@/lib/prisma';
import { Card, CardTitle, CardDescription } from '@/components/ui/card';
import { Stat } from '@/components/dashboard/stat';
import { GoogleSignIn } from '@/components/auth/google-signin';
import { SignOutButton } from '@/components/auth/sign-out-button';
import { UpgradeButton } from '@/components/billing/upgrade-button';
import { fmtDate, pct } from '@/lib/format';

export const dynamic = 'force-dynamic'; // reads the session cookie

export default async function DashboardPage() {
  const session = await getSessionUser();

  if (!session) {
    return (
      <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-6 px-6 text-center">
        <h1 className="text-2xl font-semibold">Sign in to Fanout</h1>
        <p className="text-white/60">
          Use the same Google account you send from. We only read your name and email — never your inbox.
        </p>
        <GoogleSignIn />
      </main>
    );
  }

  const user = await prisma.user.findUnique({
    where: { googleSub: session.sub },
    include: { subscription: true },
  });
  const plan = entitlementFor((user?.subscription?.plan as PlanTier) ?? 'free');

  // Usage aggregates from scrubbed telemetry (TICKET-039); never any recipient data.
  // Totals are all-time: CampaignStat holds a cumulative per-campaign lifetime
  // counter with no per-day breakdown, and Fanout spreads a campaign's sends over
  // many days (throttle + daily cap) — so a truthful "this month" isn't derivable.
  const [allTime, recent] = user
    ? await Promise.all([
        prisma.campaignStat.aggregate({
          where: { userId: user.id },
          _sum: { attempted: true, sent: true, failed: true },
          _count: true,
        }),
        prisma.campaignStat.findMany({
          where: { userId: user.id },
          orderBy: { startedAt: 'desc' },
          take: 10,
        }),
      ])
    : [null, []];

  const sent = allTime?._sum.sent ?? 0;
  const attempted = allTime?._sum.attempted ?? 0;
  const failed = allTime?._sum.failed ?? 0;
  const campaigns = allTime?._count ?? 0;

  const sub = user?.subscription;
  const renewal = fmtDate(sub?.currentPeriodEnd, true);
  const billingSuffix = !sub?.currentPeriodEnd
    ? ' — thanks for the support.'
    : sub.status === 'canceled'
      ? ` — access until ${renewal}`
      : sub.status === 'past_due'
        ? ' — payment past due'
        : ` — renews ${renewal}`;

  return (
    <main className="mx-auto max-w-4xl px-6 py-12">
      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold">Your dashboard</h1>
          <p className="mt-1 truncate text-white/60">{session.email}</p>
        </div>
        <SignOutButton />
      </div>

      <div className="mt-8 grid gap-4 sm:grid-cols-3">
        <Stat label="Sent" value={sent.toLocaleString()} sub="all-time" />
        <Stat label="Campaigns" value={campaigns.toLocaleString()} sub={`${attempted.toLocaleString()} attempted`} />
        <Stat label="Delivered" value={pct(sent, attempted)} sub={failed > 0 ? `${failed.toLocaleString()} failed` : 'no failures'} />
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <Card>
          <CardTitle className="capitalize">{plan.tier} plan</CardTitle>
          <CardDescription>
            {plan.dailyCapMax ? `${plan.dailyCapMax}/day` : 'Full daily cap'} · Scheduling{' '}
            {plan.scheduling ? 'on' : 'off'} · Attachments {plan.attachments ? 'on' : 'off'}
          </CardDescription>
        </Card>
        <Card>
          <CardTitle>Billing</CardTitle>
          {plan.tier === 'free' ? (
            <>
              <CardDescription>Unlock the full daily cap, scheduling, and attachments.</CardDescription>
              <UpgradeButton />
            </>
          ) : (
            <CardDescription>
              <span className="text-brand-400 capitalize">{plan.tier} · {sub?.status ?? 'active'}</span>
              {billingSuffix}
            </CardDescription>
          )}
        </Card>
      </div>

      <h2 className="mt-10 text-lg font-semibold">Recent campaigns</h2>
      {recent.length === 0 ? (
        <p className="mt-2 text-sm text-white/50">
          No campaigns yet. Send one from the extension and it&apos;ll show up here.
        </p>
      ) : (
        <div className="mt-3 overflow-x-auto rounded-xl border border-line">
          <table className="w-full min-w-[32rem] text-left text-sm">
            <thead className="border-b border-line text-xs uppercase tracking-wide text-white/40">
              <tr>
                <th className="px-4 py-3 font-medium">Campaign</th>
                <th className="px-4 py-3 font-medium tabular-nums">Sent</th>
                <th className="px-4 py-3 font-medium tabular-nums">Failed</th>
                <th className="px-4 py-3 font-medium tabular-nums">Cap hits</th>
                <th className="px-4 py-3 font-medium">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {recent.map((c) => (
                <tr key={c.id} className="text-white/80">
                  <td className="px-4 py-3 font-mono text-xs text-white/60">{c.campaignRef}</td>
                  <td className="px-4 py-3 tabular-nums">{c.sent}/{c.attempted}</td>
                  <td className="px-4 py-3 tabular-nums">{c.failed}</td>
                  <td className="px-4 py-3 tabular-nums">{c.capHits}</td>
                  <td className="px-4 py-3 text-white/60">{fmtDate(c.startedAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
