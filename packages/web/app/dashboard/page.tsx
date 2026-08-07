import { entitlementFor } from '@fanout/shared';
import { Card, CardTitle, CardDescription } from '@/components/ui/card';

// Proves the @fanout/shared workspace import works end-to-end in the web app.
// Real plan comes from the account/billing backend later (TICKET-040/042).
const plan = entitlementFor('free');

export default function DashboardPage() {
  return (
    <main className="mx-auto max-w-4xl px-6 py-12">
      <h1 className="text-2xl font-semibold">Your dashboard</h1>
      <p className="mt-1 text-white/60">Plan, usage, and billing. (Shell — wired in TICKET-042.)</p>

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
          <CardDescription>Manage subscription — Lemon Squeezy (TICKET-041).</CardDescription>
        </Card>
      </div>
    </main>
  );
}
