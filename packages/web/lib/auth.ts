import { OAuth2Client } from 'google-auth-library';
import { SignJWT, jwtVerify } from 'jose';

/**
 * Identity + session (TICKET-038). We verify Google's ID token server-side (never
 * trust a client-claimed identity — SECURITY §1.5), then mint our own signed
 * session cookie. No passwords, no Google secret: the web sign-in only needs
 * openid/email/profile, so a public client id is enough.
 */
const CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ?? '';
const googleClient = new OAuth2Client(CLIENT_ID);
const sessionSecret = new TextEncoder().encode(process.env.AUTH_SECRET ?? '');

export interface SessionUser {
  sub: string; // stable Google account id
  email: string;
  name?: string;
}

/** Verify a Google Identity Services credential (JWT) and extract the account. */
export async function verifyGoogleIdToken(idToken: string): Promise<SessionUser> {
  const ticket = await googleClient.verifyIdToken({ idToken, audience: CLIENT_ID });
  const p = ticket.getPayload();
  if (!p?.sub || !p.email) throw new Error('Google token missing sub/email');
  return { sub: p.sub, email: p.email, name: p.name };
}

/** Sign a 30-day session JWT (HS256, AUTH_SECRET). */
export async function createSessionToken(user: SessionUser): Promise<string> {
  return new SignJWT({ email: user.email, name: user.name ?? '' })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(user.sub)
    .setIssuedAt()
    .setExpirationTime('30d')
    .sign(sessionSecret);
}

/** Verify a session token; null if missing/invalid/expired. */
export async function readSessionToken(token: string | undefined): Promise<SessionUser | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, sessionSecret);
    if (!payload.sub) return null;
    return { sub: payload.sub, email: String(payload.email ?? ''), name: (payload.name as string) || undefined };
  } catch {
    return null;
  }
}
