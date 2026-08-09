'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

/* eslint-disable @typescript-eslint/no-explicit-any */
declare global {
  interface Window {
    google?: any;
  }
}

/** "Sign in with Google" via Google Identity Services. Returns an ID token
 *  (credential) that a server route verifies (TICKET-038). `endpoint` picks the
 *  auth realm: the user dashboard (default) or the operator admin login. */
export function GoogleSignIn({
  endpoint = '/api/auth/google',
  unauthorizedMessage = 'Sign-in failed. Please try again.',
}: {
  endpoint?: string;
  unauthorizedMessage?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
    if (!clientId) return;

    const init = () => {
      if (!window.google || !ref.current) return;
      window.google.accounts.id.initialize({
        client_id: clientId,
        callback: async (resp: { credential: string }) => {
          setError(null);
          const res = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ credential: resp.credential }),
          }).catch(() => null);
          if (!res || !res.ok) {
            setError(unauthorizedMessage);
            return;
          }
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
  }, [router, endpoint, unauthorizedMessage]);

  if (!process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID) {
    return <p className="text-sm text-red-400">Set NEXT_PUBLIC_GOOGLE_CLIENT_ID in .env to enable sign-in.</p>;
  }
  return (
    <div className="flex flex-col items-center gap-3">
      <div ref={ref} />
      {error && <p role="alert" className="text-sm text-red-400">{error}</p>}
    </div>
  );
}
