/**
 * Plan tiers and what each unlocks — the single source of truth for feature
 * gating (TICKET-035). At the free launch every tier unlocks everything, so
 * nothing is locked in the UI yet. Phase 2 tightens `free` (and Stripe sets the
 * real tier via TICKET-040/041) by editing this table — no extension re-release
 * of the gating logic needed, only the entitlement values.
 */
export type PlanTier = 'free' | 'pro' | 'team';

export interface Entitlement {
  tier: PlanTier;
  /** Max sends/day this plan allows; null = only the Gmail account cap applies. */
  dailyCapMax: number | null;
  scheduling: boolean;
  attachments: boolean;
  multiAccount: boolean;
}

/** Capabilities per tier. Launch-free: `free` unlocks all (except multi-account). */
export const ENTITLEMENTS: Record<PlanTier, Omit<Entitlement, 'tier'>> = {
  free: { dailyCapMax: null, scheduling: true, attachments: true, multiAccount: false },
  pro: { dailyCapMax: null, scheduling: true, attachments: true, multiAccount: false },
  team: { dailyCapMax: null, scheduling: true, attachments: true, multiAccount: true },
};

export function entitlementFor(tier: PlanTier): Entitlement {
  return { tier, ...ENTITLEMENTS[tier] };
}
