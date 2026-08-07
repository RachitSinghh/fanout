import { NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/session';
import { variantForCountry, createCheckout } from '@/lib/lemonsqueezy';

/**
 * Start a Pro checkout for the signed-in user (TICKET-041). Picks the geo variant
 * by the request's country (Vercel `x-vercel-ip-country`; `?country=` for local
 * testing) and returns the hosted checkout URL for the client to redirect to.
 */
export async function POST(req: Request) {
  const session = await getSessionUser();
  if (!session) return NextResponse.json({ error: 'not signed in' }, { status: 401 });

  const url = new URL(req.url);
  // Production trusts ONLY the Vercel geo header; `?country=` is a dev/test override
  // (else any user could pick the cheaper India price).
  const devOverride = process.env.NODE_ENV === 'production' ? null : url.searchParams.get('country');
  const country = req.headers.get('x-vercel-ip-country') ?? devOverride;
  // Post-payment redirect must be a configured origin, not the (spoofable) request Host.
  const appOrigin = process.env.NEXT_PUBLIC_APP_URL || url.origin;

  try {
    const variantId = await variantForCountry(country);
    if (!variantId) return NextResponse.json({ error: 'no plan configured' }, { status: 500 });

    const checkoutUrl = await createCheckout({
      variantId,
      email: session.email,
      userSub: session.sub,
      redirectUrl: `${appOrigin}/dashboard`,
    });
    return NextResponse.json({ url: checkoutUrl });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'checkout failed' }, { status: 502 });
  }
}
