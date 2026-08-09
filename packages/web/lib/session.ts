import { cookies } from 'next/headers';
import { readSessionToken, REALM_USER, REALM_ADMIN, type SessionUser } from './auth';

export const SESSION_COOKIE = 'fanout_session';
// The operator dashboard is a SEPARATE auth realm: its own cookie holding a token
// bound to the admin realm (audience). The separation is cryptographic — a user
// session token can't be verified as admin — so both cookies can safely live at
// path '/'. Issued only to allowlisted operators at login (see /api/auth/admin).
export const ADMIN_SESSION_COOKIE = 'fanout_admin_session';

/** Standard cookie options for a session cookie (shared by both realms so their
 *  security settings can't drift apart). */
export function sessionCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    path: '/',
    maxAge: 60 * 60 * 24 * 30,
  };
}

/** The signed-in user for the current request, or null. Server-side only. */
export async function getSessionUser(): Promise<SessionUser | null> {
  const store = await cookies();
  return readSessionToken(store.get(SESSION_COOKIE)?.value, REALM_USER);
}

/** The signed-in OPERATOR for the current request, or null. Reads the separate
 *  admin-realm cookie — independent of the user dashboard session. Server-only. */
export async function getAdminSession(): Promise<SessionUser | null> {
  const store = await cookies();
  return readSessionToken(store.get(ADMIN_SESSION_COOKIE)?.value, REALM_ADMIN);
}

/** True if `sub` is in the operator allowlist (SECURITY §2.5). */
export function isOperator(sub: string | undefined): boolean {
  if (!sub) return false;
  const allow = (process.env.ADMIN_GOOGLE_SUBS ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  return allow.includes(sub);
}
