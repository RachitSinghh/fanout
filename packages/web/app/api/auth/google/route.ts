import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyGoogleIdToken, createSessionToken } from '@/lib/auth';
import { SESSION_COOKIE } from '@/lib/session';
import { prisma } from '@/lib/prisma';

/** Exchange a Google Identity Services credential for a Fanout session, upserting
 *  the user (identity only — no gmail.send here). TICKET-038. */
export async function POST(req: Request) {
  const { credential } = (await req.json().catch(() => ({}))) as { credential?: string };
  if (!credential) return NextResponse.json({ error: 'missing credential' }, { status: 400 });

  let user;
  try {
    user = await verifyGoogleIdToken(credential);
  } catch {
    return NextResponse.json({ error: 'invalid Google token' }, { status: 401 });
  }

  await prisma.user.upsert({
    where: { googleSub: user.sub },
    update: { email: user.email, name: user.name ?? null, lastSeenAt: new Date() },
    create: { googleSub: user.sub, email: user.email, name: user.name ?? null, lastSeenAt: new Date() },
  });

  const token = await createSessionToken(user);
  const store = await cookies();
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 30,
  });

  return NextResponse.json({ ok: true, user: { email: user.email, name: user.name } });
}
