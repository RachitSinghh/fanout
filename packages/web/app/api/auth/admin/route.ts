import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyGoogleIdToken, createSessionToken } from '@/lib/auth';
import { ADMIN_SESSION_COOKIE, ADMIN_COOKIE_PATH, isOperator } from '@/lib/session';

/**
 * Operator sign-in — the SEPARATE admin auth realm (SECURITY §2.5). Verifies the
 * Google credential, then issues the admin session cookie ONLY if the account is
 * on the operator allowlist. A non-operator is rejected here at login and never
 * receives a cookie — the allowlist is enforced at the door, not just in the UI.
 */
export async function POST(req: Request) {
  const { credential } = (await req.json().catch(() => ({}))) as { credential?: string };
  if (!credential) return NextResponse.json({ error: 'missing credential' }, { status: 400 });

  let user;
  try {
    user = await verifyGoogleIdToken(credential);
  } catch {
    return NextResponse.json({ error: 'invalid Google token' }, { status: 401 });
  }

  if (!isOperator(user.sub)) {
    return NextResponse.json({ error: 'not an operator' }, { status: 403 });
  }

  const token = await createSessionToken(user);
  const store = await cookies();
  store.set(ADMIN_SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: ADMIN_COOKIE_PATH,
    maxAge: 60 * 60 * 24 * 30,
  });

  return NextResponse.json({ ok: true });
}
