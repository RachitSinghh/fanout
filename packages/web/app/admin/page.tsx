import { getSessionUser, isOperator } from '@/lib/session';
import { Card, CardTitle, CardDescription } from '@/components/ui/card';
import { GoogleSignIn } from '@/components/auth/google-signin';

export const dynamic = 'force-dynamic'; // reads the session cookie

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

  return (
    <main className="mx-auto max-w-5xl px-6 py-12">
      <h1 className="text-2xl font-semibold">Admin</h1>
      <p className="mt-1 text-white/60">
        Operator monitoring — you&apos;re on the allowlist. (Shell — wired in TICKET-043.)
      </p>
      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {['Signups', 'Free → Paid', 'Send health', 'Errors'].map((label) => (
          <Card key={label}>
            <CardTitle>{label}</CardTitle>
            <CardDescription>From accounts + billing + telemetry.</CardDescription>
          </Card>
        ))}
      </div>
    </main>
  );
}
