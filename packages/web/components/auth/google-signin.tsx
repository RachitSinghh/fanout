'use client';

import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';

/* eslint-disable @typescript-eslint/no-explicit-any */
declare global {
  interface Window {
    google?: any;
  }
}

/** "Sign in with Google" via Google Identity Services. Returns an ID token
 *  (credential) that our /api/auth/google verifies server-side (TICKET-038). */
export function GoogleSignIn() {
  const ref = useRef<HTMLDivElement>(null);
  const router = useRouter();

  useEffect(() => {
    const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
    if (!clientId) return;

    const init = () => {
      if (!window.google || !ref.current) return;
      window.google.accounts.id.initialize({
        client_id: clientId,
        callback: async (resp: { credential: string }) => {
          await fetch('/api/auth/google', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ credential: resp.credential }),
          });
          router.refresh();
        },
      });
      window.google.accounts.id.renderButton(ref.current, {
        theme: 'filled_black',
        size: 'large',
        shape: 'pill',
        text: 'signin_with',
      });
    };

    if (window.google) {
      init();
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.onload = init;
    document.head.appendChild(script);
  }, [router]);

  if (!process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID) {
    return <p className="text-sm text-red-400">Set NEXT_PUBLIC_GOOGLE_CLIENT_ID in .env to enable sign-in.</p>;
  }
  return <div ref={ref} />;
}
