import { entitlementFor, type Entitlement, type PlanTier } from '@fanout/shared';
import { getSetting, setSetting, SETTING_KEYS } from '../db/settings';
import { config, isDev } from '../lib/config';
import * as auth from './authService';

const TIERS: readonly PlanTier[] = ['free', 'pro', 'team'];
const isTier = (v: unknown): v is PlanTier => typeof v === 'string' && (TIERS as readonly string[]).includes(v);

/**
 * Current plan entitlement (TICKET-040). Resolves the tier from the backend
 * `/api/entitlement` (single source of truth, plan set only by verified billing
 * webhooks), caches it, and — when offline or no backend — falls back to the last
 * cached tier, else `free`. Never invents a paid tier offline (SECURITY §4.5).
 *
 * Memoized for MEMO_TTL_MS so the send engine can resolve the cap on its hot path
 * (per tick / per send) without a network round trip or IndexedDB read each time.
 * The memo lives in worker memory only, so a fresh worker always re-resolves, and
 * a plan change is picked up within the TTL even during an unattended campaign.
 */
const MEMO_TTL_MS = 5 * 60 * 1000;
let memo: { at: number; ent: Entitlement } | null = null;

export async function getEntitlement(): Promise<Entitlement> {
  if (memo && Date.now() - memo.at < MEMO_TTL_MS) return memo.ent;
  const ent = await resolveEntitlement();
  memo = { at: Date.now(), ent };
  return ent;
}

async function resolveEntitlement(): Promise<Entitlement> {
  // Dev-only override for local testing; NEVER honored in production, so it can
  // never be used to defeat the paywall on a shipped build.
  if (isDev) {
    const override = await getSetting<unknown>(SETTING_KEYS.planOverride, null);
    if (isTier(override)) return entitlementFor(override);
  }

  const identity = await auth.getIdentity();
  if (!config.backendUrl || !identity?.sub) return entitlementFor(await cachedTier());

  try {
    const res = await fetch(`${config.backendUrl}/api/entitlement?sub=${encodeURIComponent(identity.sub)}`);
    if (!res.ok) throw new Error(`entitlement ${res.status}`);
    const data = (await res.json()) as { tier?: unknown };
    const tier: PlanTier = isTier(data.tier) ? data.tier : 'free';
    await setSetting(SETTING_KEYS.cachedLicense, tier);
    return entitlementFor(tier);
  } catch {
    // Offline / backend down: honor the last known tier, never upgrade.
    return entitlementFor(await cachedTier());
  }
}

/** Last known tier from local cache, validated. Unknown/corrupt → 'free' (fail
 *  closed: a bad cache value must never uncap the account). */
async function cachedTier(): Promise<PlanTier> {
  const cached = await getSetting<unknown>(SETTING_KEYS.cachedLicense, null);
  return isTier(cached) ? cached : 'free';
}

/**
 * The plan's daily send cap for the send engine's cap GUARD, resolved from LOCAL
 * cache only — NEVER a network call. The daily cap must be checked before any
 * network I/O to protect the account (ARCHITECTURE §7, TICKET-010), so this reads
 * the persisted last-known tier (survives worker death) and fails closed to the
 * free cap on an unknown/missing value. The remote tier is refreshed off the hot
 * path — on each `sendOne` and at run start — so a plan change still propagates.
 */
export async function cachedPlanDailyCap(): Promise<number | null> {
  if (isDev) {
    const override = await getSetting<unknown>(SETTING_KEYS.planOverride, null);
    if (isTier(override)) return entitlementFor(override).dailyCapMax;
  }
  return entitlementFor(await cachedTier()).dailyCapMax;
}
