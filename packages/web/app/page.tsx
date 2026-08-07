import Link from 'next/link';
import { Button } from '@/components/ui/button';

export default function Home() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-3xl flex-col items-center justify-center px-6 text-center">
      <span className="grid h-12 w-12 place-items-center rounded-xl bg-accent text-warm">
        {/* lucide has no paper-plane-tilt; use a simple mark */}
        <svg viewBox="0 0 24 24" width="22" height="22" fill="none" aria-hidden>
          <path d="M22 2 15 22 11 13 2 9 22 2Z" fill="#131209" />
        </svg>
      </span>
      <h1 className="mt-6 bg-gradient-to-r from-white to-neutral-400 bg-clip-text text-5xl font-bold tracking-tight text-transparent">
        Fanout
      </h1>
      <p className="mt-4 max-w-xl text-lg text-white/70">
        Send N individual emails from your own Gmail — personalized, throttled, and safe.
        Your recipients never leave your browser.
      </p>
      <div className="mt-8 flex items-center gap-3">
        <Button size="lg">Add to Chrome</Button>
        <Button size="lg" variant="secondary" asChild>
          <Link href="/dashboard">Open dashboard</Link>
        </Button>
      </div>
      <p className="mt-16 text-xs text-white/30">
        Phase 2 scaffold — marketing, dashboard, and admin shells. Design ported next (TICKET-037).
      </p>
    </main>
  );
}
