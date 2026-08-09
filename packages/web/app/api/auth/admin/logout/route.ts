import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { ADMIN_SESSION_COOKIE } from '@/lib/session';

/** Clear the operator session. Only the admin realm — the user dashboard session
 *  is a separate realm and logs out independently. */
export async function POST() {
  const store = await cookies();
  store.delete({ name: ADMIN_SESSION_COOKIE, path: '/' });
  return NextResponse.json({ ok: true });
}
