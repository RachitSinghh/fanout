import { describe, it, expect } from 'vitest';
import { effectiveDailyCap } from './rateLimiter';

describe('effectiveDailyCap', () => {
  it('returns the account ceiling when no plan/campaign cap applies', () => {
    expect(effectiveDailyCap('consumer', null)).toBe(500);
    expect(effectiveDailyCap('workspace', null)).toBe(2000);
  });

  it('clamps to the plan cap (free tier) when it is the smallest', () => {
    // consumer ceiling 500, free plan cap 50 → 50 wins
    expect(effectiveDailyCap('consumer', null, 50)).toBe(50);
  });

  it('takes the smallest of account, plan, and campaign caps', () => {
    expect(effectiveDailyCap('workspace', 20, 50)).toBe(20); // campaign tightest
    expect(effectiveDailyCap('workspace', 80, 50)).toBe(50); // plan tightest
    expect(effectiveDailyCap('consumer', 700, null)).toBe(500); // account tightest
  });
});
