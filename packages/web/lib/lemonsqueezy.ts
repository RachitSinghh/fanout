import crypto from 'node:crypto';

/**
 * Lemon Squeezy (Merchant of Record) helpers (TICKET-041). Raw JSON:API calls —
 * no SDK dep. Handles geo variant selection, checkout creation, and webhook
 * signature verification. Billing is the ONLY source of truth for plan
 * (SECURITY §3.2): plan changes come from verified webhooks, never the client.
 */
const API = 'https://api.lemonsqueezy.com/v1';
const STORE_ID = process.env.LEMONSQUEEZY_STORE_ID ?? '';
const API_KEY = process.env.LEMONSQUEEZY_API_KEY ?? '';

function headers() {
  return {
    Accept: 'application/vnd.api+json',
    'Content-Type': 'application/vnd.api+json',
    Authorization: `Bearer ${API_KEY}`,
  };
}

export interface StoreVariant {
  variantId: string;
  productName: string;
}

// Short TTL so a price/variant change in Lemon Squeezy propagates within minutes,
// instead of being pinned for the life of a warm serverless instance.
const CACHE_TTL_MS = 5 * 60 * 1000;
let variantCache: { at: number; data: StoreVariant[] } | null = null;

/** Every store variant joined to its product name. The `/variants` endpoint does
 *  NOT allow `filter[store_id]` (400), so we list the store's products with their
 *  variants included and flatten — one StoreVariant per (product, variant). */
async function listVariants(): Promise<StoreVariant[]> {
  if (variantCache && Date.now() - variantCache.at < CACHE_TTL_MS) return variantCache.data;
  const res = await fetch(`${API}/products?filter[store_id]=${STORE_ID}&include=variants`, { headers: headers() });
  if (!res.ok) throw new Error(`LS products ${res.status}`);
  const json = (await res.json()) as {
    data: { id: string; attributes: { name: string }; relationships: { variants: { data: { id: string }[] } } }[];
  };
  const data = json.data.flatMap((p) =>
    (p.relationships.variants.data ?? []).map((v) => ({ variantId: v.id, productName: p.attributes.name })),
  );
  variantCache = { at: Date.now(), data };
  return data;
}

/**
 * Pick the variant for a country: IN → the "India" product, everyone else → the
 * global product. Fails CLOSED for non-IN (returns null rather than falling back
 * to the cheaper India variant) so a naming slip can never undercharge the world.
 */
export async function variantForCountry(country: string | null): Promise<string | null> {
  const variants = await listVariants();
  if (variants.length === 0) return null;
  const india = variants.find((v) => /india/i.test(v.productName));
  const global = variants.find((v) => !/india/i.test(v.productName));
  if (country === 'IN') return (india ?? global)?.variantId ?? null;
  return global?.variantId ?? null;
}

/** Create a hosted checkout; returns its URL. `userSub` rides along in custom
 *  data so the webhook can attribute the subscription to our user. */
export async function createCheckout(opts: {
  variantId: string;
  email: string;
  userSub: string;
  redirectUrl: string;
}): Promise<string> {
  const body = {
    data: {
      type: 'checkouts',
      attributes: {
        checkout_data: { email: opts.email, custom: { user_sub: opts.userSub } },
        product_options: { redirect_url: opts.redirectUrl },
      },
      relationships: {
        store: { data: { type: 'stores', id: STORE_ID } },
        variant: { data: { type: 'variants', id: opts.variantId } },
      },
    },
  };
  const res = await fetch(`${API}/checkouts`, { method: 'POST', headers: headers(), body: JSON.stringify(body) });
  if (!res.ok) throw new Error(`LS checkout ${res.status}: ${await res.text()}`);
  const json = (await res.json()) as { data: { attributes: { url: string } } };
  return json.data.attributes.url;
}

/** Verify a Lemon Squeezy webhook's X-Signature (HMAC-SHA256 of the raw body). */
export function verifyWebhookSignature(rawBody: string, signature: string | null): boolean {
  const secret = process.env.LEMONSQUEEZY_WEBHOOK_SECRET ?? '';
  if (!secret || !signature) return false;
  const digest = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
  try {
    return crypto.timingSafeEqual(Buffer.from(digest), Buffer.from(signature));
  } catch {
    return false;
  }
}

/** Map a Lemon Squeezy subscription status to our SubStatus enum values. */
export function mapStatus(ls: string): 'active' | 'trialing' | 'past_due' | 'canceled' {
  switch (ls) {
    case 'on_trial':
      return 'trialing';
    case 'active':
      return 'active';
    case 'past_due':
    case 'unpaid':
      return 'past_due';
    default:
      return 'canceled'; // cancelled, expired, paused
  }
}
