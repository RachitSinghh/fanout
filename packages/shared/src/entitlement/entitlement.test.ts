import { describe, it, expect } from 'vitest';
import { entitlementFor, FREE_DAILY_CAP, type PlanTier } from './index';

describe('entitlementFor', () => {
  it('free is capped and locks scheduling, attachments, multi-account', () => {
    expect(entitlementFor('free')).toEqual({
      tier: 'free',
      dailyCapMax: FREE_DAILY_CAP,
      scheduling: false,
      attachments: false,
      multiAccount: false,
    });
  });

  it('pro unlocks scheduling + attachments with no plan daily cap', () => {
    expect(entitlementFor('pro')).toMatchObject({
      dailyCapMax: null,
      scheduling: true,
      attachments: true,
    });
  });

  it('falls closed to free capabilities for an unknown tier', () => {
    // Simulates a corrupt persisted value cast to PlanTier at a trust boundary —
    // must never leave caps undefined (which would read as "no daily cap").
    const ent = entitlementFor('garbage' as PlanTier);
    expect(ent.dailyCapMax).toBe(FREE_DAILY_CAP);
    expect(ent.scheduling).toBe(false);
    expect(ent.attachments).toBe(false);
  });

  it('team is the only tier with multi-account', () => {
    expect(entitlementFor('team').multiAccount).toBe(true);
    expect(entitlementFor('pro').multiAccount).toBe(false);
  });
});
