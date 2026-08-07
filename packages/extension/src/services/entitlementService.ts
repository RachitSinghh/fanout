import { entitlementFor, type Entitlement, type PlanTier } from '@fanout/shared';
import { getSetting, setSetting, SETTING_KEYS } from '../db/settings';
import { config } from '../lib/config';
import * as auth from './authService';

const TIERS: readonly PlanTier[] = ['free', 'pro', 'team'];
const isTier = (v: unknown): v is PlanTier => typeof v === 'string' && (TIERS as readonly string[]).includes(v);

/**
 * Current plan entitlement (TICKET-040). Resolves the tier from the backend
 * `/api/entitlement` (single source of truth, plan set only by verified billing
 * webhooks), caches it, and — when offline or no backend — falls back to the last
 * cached tier, else `free`. Never invents a paid tier offline (SECURITY §4.5).
 *
 * A `planOverride` setting forces a tier for dev. The UI seam is unchanged from
 * the 035 stub — swapping in this real resolver needed no UI change.
 */
export async function getEntitlement(): Promise<Entitlement> {
  const override = await getSetting<PlanTier | null>(SETTING_KEYS.planOverride, null);
  if (override) return entitlementFor(override);

  const identity = await auth.getIdentity();
  if (!config.backendUrl || !identity?.sub) {
    const cached = await getSetting<PlanTier | null>(SETTING_KEYS.cachedLicense, null);
    return entitlementFor(cached ?? 'free');
  }

  try {
    const res = await fetch(`${config.backendUrl}/api/entitlement?sub=${encodeURIComponent(identity.sub)}`);
    if (!res.ok) throw new Error(`entitlement ${res.status}`);
    const data = (await res.json()) as { tier?: unknown };
    const tier: PlanTier = isTier(data.tier) ? data.tier : 'free';
    await setSetting(SETTING_KEYS.cachedLicense, tier);
    return entitlementFor(tier);
  } catch {
    // Offline / backend down: honor the last known tier, never upgrade.
    const cached = await getSetting<PlanTier | null>(SETTING_KEYS.cachedLicense, null);
    return entitlementFor(cached ?? 'free');
  }
}
