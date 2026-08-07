import { describe, it, expect } from 'vitest';
import { entitlementFor } from './index';

describe('entitlementFor', () => {
  it('free unlocks scheduling + attachments at launch, not multi-account', () => {
    expect(entitlementFor('free')).toEqual({
      tier: 'free',
      dailyCapMax: null,
      scheduling: true,
      attachments: true,
      multiAccount: false,
    });
  });

  it('team is the only tier with multi-account', () => {
    expect(entitlementFor('team').multiAccount).toBe(true);
    expect(entitlementFor('pro').multiAccount).toBe(false);
  });
});
