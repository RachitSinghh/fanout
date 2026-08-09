import { getAdminSession, isOperator } from '@/lib/session';
import { prisma } from '@/lib/prisma';
import { Card, CardTitle } from '@/components/ui/card';
import { Stat } from '@/components/dashboard/stat';
import { GoogleSignIn } from '@/components/auth/google-signin';
import { SignOutButton } from '@/components/auth/sign-out-button';
import { fmtDate, fmtDateTime, pct } from '@/lib/format';

export const dynamic = 'force-dynamic'; // reads the admin session cookie

// The admin login screen — a SEPARATE realm from the user dashboard. Sign-in only
// succeeds for allowlisted operators (enforced in /api/auth/admin).
function AdminSignIn() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-6 px-6 text-center">
      <h1 className="text-2xl font-semibold">Operator sign-in</h1>
      <p className="text-white/60">Sign in with an operator account to view monitoring.</p>
      <GoogleSignIn endpoint="/api/auth/admin" unauthorizedMessage="This account isn't an operator." />
    </main>
  );
}

export default async function AdminPage() {
  const session = await getAdminSession();

  // No admin session → show the operator sign-in (not the user dashboard's).
  // Re-check the allowlist as defense in depth: a cookie issued to an operator who
  // was later removed from ADMIN_GOOGLE_SUBS must lose access immediately.
  if (!session || !isOperator(session.sub)) {
    return <AdminSignIn />;
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
      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold">Admin</h1>
          <p className="mt-1 truncate text-white/60">{session.email} · scrubbed metadata only</p>
        </div>
        <SignOutButton endpoint="/api/auth/admin/logout" />
      </div>

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
