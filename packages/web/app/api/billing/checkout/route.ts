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
  const country = req.headers.get('x-vercel-ip-country') ?? url.searchParams.get('country');

  try {
    const variantId = await variantForCountry(country);
    if (!variantId) return NextResponse.json({ error: 'no plan configured' }, { status: 500 });

    const checkoutUrl = await createCheckout({
      variantId,
      email: session.email,
      userSub: session.sub,
      redirectUrl: `${url.origin}/dashboard`,
    });
    return NextResponse.json({ url: checkoutUrl });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'checkout failed' }, { status: 502 });
  }
}
