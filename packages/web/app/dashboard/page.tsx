import { entitlementFor, type PlanTier } from '@fanout/shared';
import { getSessionUser } from '@/lib/session';
import { prisma } from '@/lib/prisma';
import { Card, CardTitle, CardDescription } from '@/components/ui/card';
import { GoogleSignIn } from '@/components/auth/google-signin';
import { SignOutButton } from '@/components/auth/sign-out-button';
import { UpgradeButton } from '@/components/billing/upgrade-button';

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
        <Card>
          <CardTitle className="capitalize">{plan.tier} plan</CardTitle>
          <CardDescription>
            Scheduling {plan.scheduling ? 'on' : 'off'} · Attachments {plan.attachments ? 'on' : 'off'}
          </CardDescription>
        </Card>
        <Card>
          <CardTitle>Usage</CardTitle>
          <CardDescription>Sends this period — from telemetry (TICKET-039).</CardDescription>
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
              <span className="text-brand-400">Pro · active</span> — thanks for the support.
            </CardDescription>
          )}
        </Card>
      </div>
    </main>
  );
}
