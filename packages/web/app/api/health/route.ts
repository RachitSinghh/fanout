import { NextResponse } from 'next/server';

/** Liveness check — also proves API route handlers work in this app.
 *  Real endpoints (/api/entitlement, /api/telemetry, /api/auth) land in Phase 2. */
export function GET() {
  return NextResponse.json({ ok: true, service: 'fanout-web' });
}
