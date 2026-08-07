'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';

/** Kicks off a Pro checkout (TICKET-041): POST /api/billing/checkout → redirect
 *  to the Lemon Squeezy hosted checkout. */
export function UpgradeButton() {
  const [busy, setBusy] = useState(false);
  return (
    <Button
      size="sm"
      className="mt-3"
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        try {
          const res = await fetch('/api/billing/checkout', { method: 'POST' });
          const { url } = (await res.json()) as { url?: string };
          if (url) window.location.href = url;
          else setBusy(false);
        } catch {
          setBusy(false);
        }
      }}
    >
      {busy ? 'Redirecting…' : 'Upgrade to Pro'}
    </Button>
  );
}
