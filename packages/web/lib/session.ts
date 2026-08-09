import { cookies } from 'next/headers';
import { readSessionToken, type SessionUser } from './auth';

export const SESSION_COOKIE = 'fanout_session';
// The operator dashboard is a SEPARATE auth realm: its own cookie, scoped to the
// /admin path so a user's dashboard session never carries into /admin and vice
// versa. Issued only to allowlisted operators at login (see /api/auth/admin).
export const ADMIN_SESSION_COOKIE = 'fanout_admin_session';
export const ADMIN_COOKIE_PATH = '/admin';

/** The signed-in user for the current request, or null. Server-side only. */
export async function getSessionUser(): Promise<SessionUser | null> {
  const store = await cookies();
  return readSessionToken(store.get(SESSION_COOKIE)?.value);
}

/** The signed-in OPERATOR for the current request, or null. Reads the separate
 *  admin cookie — independent of the user dashboard session. Server-side only. */
export async function getAdminSession(): Promise<SessionUser | null> {
  const store = await cookies();
  return readSessionToken(store.get(ADMIN_SESSION_COOKIE)?.value);
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
