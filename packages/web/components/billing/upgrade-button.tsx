'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';

/** Kicks off a Pro checkout (TICKET-041): POST /api/billing/checkout → redirect
 *  to the Lemon Squeezy hosted checkout. Surfaces failures to the user. */
export function UpgradeButton() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="mt-3">
      <Button
        size="sm"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          setError(null);
          try {
            const res = await fetch('/api/billing/checkout', { method: 'POST' });
            const data = (await res.json().catch(() => ({}))) as { url?: string };
            if (res.ok && data.url) {
              window.location.href = data.url;
              return; // navigating away; keep the button busy
            }
            setError('Could not start checkout. Please try again.');
          } catch {
            setError('Network error. Please try again.');
          }
          setBusy(false);
        }}
      >
        {busy ? 'Redirecting…' : 'Upgrade to Pro'}
      </Button>
      {error && <p role="alert" className="mt-2 text-xs text-red-400">{error}</p>}
    </div>
  );
}
