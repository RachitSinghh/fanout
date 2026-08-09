import { getSessionUser, isOperator } from '@/lib/session';
import { prisma } from '@/lib/prisma';
import { Card, CardTitle } from '@/components/ui/card';
import { Stat } from '@/components/dashboard/stat';
import { GoogleSignIn } from '@/components/auth/google-signin';

export const dynamic = 'force-dynamic'; // reads the session cookie

const fmtDate = (d: Date | null | undefined) =>
  d ? d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : '—';
const fmtDateTime = (d: Date) =>
  d.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
const pct = (n: number, d: number) => (d > 0 ? `${Math.round((n / d) * 100)}%` : '—');

export default async function AdminPage() {
  const session = await getSessionUser();

  if (!session) {
    return (
      <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-6 px-6 text-center">
        <h1 className="text-2xl font-semibold">Operator sign-in</h1>
        <p className="text-white/60">Sign in with an operator account to view monitoring.</p>
        <GoogleSignIn />
      </main>
    );
  }

  // Allowlist gate — a stray field can never grant admin (SECURITY §2.5).
  if (!isOperator(session.sub)) {
    return (
      <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-3 px-6 text-center">
        <h1 className="text-2xl font-semibold">Not authorized</h1>
        <p className="text-white/60">
          This is the operator dashboard. Your account ({session.email}) isn&apos;t on the allowlist.
        </p>
        <p className="mt-2 font-mono text-xs text-white/40">
          Add this to ADMIN_GOOGLE_SUBS to grant access:
          <br />
          {session.sub}
        </p>
      </main>
    );
  }

  // Aggregate monitoring — all scrubbed metadata; never any recipient data.
  const [userCount, paidCount, sendAgg, errorCount, recentErrors, recentUsers] = await Promise.all([
    prisma.user.count(),
    prisma.subscription.count({
      where: { plan: { in: ['pro', 'team'] }, status: { in: ['active', 'trialing', 'past_due'] } },
    }),
    prisma.campaignStat.aggregate({ _sum: { attempted: true, sent: true, failed: true, capHits: true } }),
    prisma.errorEvent.count(),
    prisma.errorEvent.findMany({ orderBy: { createdAt: 'desc' }, take: 15 }),
    prisma.user.findMany({ orderBy: { createdAt: 'desc' }, take: 15, include: { subscription: true } }),
  ]);

  const attempted = sendAgg._sum.attempted ?? 0;
  const sent = sendAgg._sum.sent ?? 0;
  const failed = sendAgg._sum.failed ?? 0;
  const capHits = sendAgg._sum.capHits ?? 0;

  return (
    <main className="mx-auto max-w-5xl px-6 py-12">
      <h1 className="text-2xl font-semibold">Admin</h1>
      <p className="mt-1 text-white/60">Operator monitoring — scrubbed metadata only.</p>

      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Signups" value={userCount.toLocaleString()} />
        <Stat label="Paying" value={paidCount.toLocaleString()} sub={`${pct(paidCount, userCount)} conversion`} />
        <Stat label="Delivered" value={pct(sent, attempted)} sub={`${sent.toLocaleString()} / ${attempted.toLocaleString()} sent`} />
        <Stat label="Errors" value={errorCount.toLocaleString()} sub={`${failed.toLocaleString()} sends failed · ${capHits.toLocaleString()} cap hits`} />
      </div>

      <div className="mt-10 grid gap-8 lg:grid-cols-2">
        <section>
          <CardTitle>Recent signups</CardTitle>
          <Table
            head={['Account', 'Plan', 'Joined']}
            empty="No users yet."
            rows={recentUsers.map((u) => [
              <span key="e" className="font-mono text-xs text-white/60">{u.email}</span>,
              <span key="p" className="capitalize">{u.subscription?.plan ?? 'free'}</span>,
              fmtDate(u.createdAt),
            ])}
          />
        </section>

        <section>
          <CardTitle>Recent errors</CardTitle>
          <Table
            head={['Kind', 'HTTP', 'Ext', 'When']}
            empty="No errors reported."
            rows={recentErrors.map((e) => [
              <span key="k" className="font-mono text-xs">{e.kind}</span>,
              e.httpStatus ?? '—',
              <span key="v" className="text-white/60">{e.extVersion}</span>,
              <span key="w" className="text-white/60">{fmtDateTime(e.createdAt)}</span>,
            ])}
          />
        </section>
      </div>
    </main>
  );
}

/** Lean monitoring table (TICKET-043). */
function Table({ head, rows, empty }: { head: string[]; rows: React.ReactNode[][]; empty: string }) {
  if (rows.length === 0) return <p className="mt-3 text-sm text-white/50">{empty}</p>;
  return (
    <div className="mt-3 overflow-x-auto rounded-xl border border-line">
      <table className="w-full text-left text-sm">
        <thead className="border-b border-line text-xs uppercase tracking-wide text-white/40">
          <tr>
            {head.map((h) => (
              <th key={h} className="px-4 py-3 font-medium">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {rows.map((cells, i) => (
            <tr key={i} className="text-white/80">
              {cells.map((cell, j) => (
                <td key={j} className="px-4 py-3 tabular-nums">{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
