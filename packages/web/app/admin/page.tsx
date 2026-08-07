import { Card, CardTitle, CardDescription } from '@/components/ui/card';

// Operator-only view. Access will be gated by an allowlist of operator Google
// accounts (SECURITY §2.5) once auth lands (TICKET-038/043).
export default function AdminPage() {
  return (
    <main className="mx-auto max-w-5xl px-6 py-12">
      <h1 className="text-2xl font-semibold">Admin</h1>
      <p className="mt-1 text-white/60">
        Operator monitoring — gated to allowlisted accounts. (Shell — wired in TICKET-043.)
      </p>

      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {['Signups', 'Free → Paid', 'Send health', 'Errors'].map((label) => (
          <Card key={label}>
            <CardTitle>{label}</CardTitle>
            <CardDescription>From accounts + Stripe + telemetry.</CardDescription>
          </Card>
        ))}
      </div>
    </main>
  );
}
