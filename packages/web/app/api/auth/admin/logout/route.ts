import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { ADMIN_SESSION_COOKIE, ADMIN_COOKIE_PATH } from '@/lib/session';

/** Clear the operator session (must match the cookie's scoped path to delete it). */
export async function POST() {
  const store = await cookies();
  store.delete({ name: ADMIN_SESSION_COOKIE, path: ADMIN_COOKIE_PATH });
  return NextResponse.json({ ok: true });
}
