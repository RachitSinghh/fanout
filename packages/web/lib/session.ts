import { cookies } from 'next/headers';
import { readSessionToken, type SessionUser } from './auth';

export const SESSION_COOKIE = 'fanout_session';

/** The signed-in user for the current request, or null. Server-side only. */
export async function getSessionUser(): Promise<SessionUser | null> {
  const store = await cookies();
  return readSessionToken(store.get(SESSION_COOKIE)?.value);
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
