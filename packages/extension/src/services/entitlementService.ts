import { entitlementFor, type Entitlement, type PlanTier } from '@fanout/shared';
import { getSetting, SETTING_KEYS } from '../db/settings';

/**
 * Current plan entitlement (TICKET-035). Phase-1 STUB: always `free`, unless a
 * dev override forces a tier via settings. Phase 2 (TICKET-040) swaps this body
 * for a cached call to `/api/entitlement` derived from the Stripe-backed
 * subscription — with no change to callers or UI.
 */
export async function getEntitlement(): Promise<Entitlement> {
  const override = await getSetting<PlanTier | null>(SETTING_KEYS.planOverride, null);
  return entitlementFor(override ?? 'free');
}
