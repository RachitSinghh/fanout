/**
 * Plan tiers and what each unlocks — the single source of truth for feature
 * gating (TICKET-035). The gating logic in the extension reads these values;
 * changing the plan (via verified billing, TICKET-040/041) or these values
 * needs no extension re-release. Free is capped; Pro/Team unlock the full daily
 * limit, scheduling, and attachments.
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

/** Capabilities per tier. Free is capped at FREE_DAILY_CAP/day with scheduling
 *  and attachments locked; paid tiers unlock the full account daily limit. */
export const FREE_DAILY_CAP = 50;
export const ENTITLEMENTS: Record<PlanTier, Omit<Entitlement, 'tier'>> = {
  free: { dailyCapMax: FREE_DAILY_CAP, scheduling: false, attachments: false, multiAccount: false },
  pro: { dailyCapMax: null, scheduling: true, attachments: true, multiAccount: false },
  team: { dailyCapMax: null, scheduling: true, attachments: true, multiAccount: true },
};

export function entitlementFor(tier: PlanTier): Entitlement {
  // Fail closed: an unknown tier (e.g. a corrupt persisted value cast to PlanTier
  // at a trust boundary) resolves to the most-restrictive `free` capabilities
  // rather than leaving fields undefined (which would read as "no cap").
  return { tier, ...(ENTITLEMENTS[tier] ?? ENTITLEMENTS.free) };
}
