import { describe, it, expect } from 'vitest';
import { nextDelayMs } from './throttle';
import { backoffMs, canRetry } from './retry';
import { localDay, effectiveDailyCap, msUntilNextLocalMidnight } from './rateLimiter';
import { RETRY } from '@fanout/shared';

describe('nextDelayMs', () => {
  it('returns the exact delay in fixed mode', () => {
    expect(nextDelayMs({ mode: 'fixed', minMs: 5000, maxMs: 30000 })).toBe(5000);
  });
  it('returns a value within [min,max] in random mode', () => {
    for (let i = 0; i < 100; i++) {
      const d = nextDelayMs({ mode: 'random', minMs: 8000, maxMs: 30000 });
      expect(d).toBeGreaterThanOrEqual(8000);
      expect(d).toBeLessThanOrEqual(30000);
    }
  });
});

describe('retry policy', () => {
  it('allows retries below the max attempts', () => {
    expect(canRetry(1)).toBe(true);
    expect(canRetry(RETRY.maxAttempts - 1)).toBe(true);
    expect(canRetry(RETRY.maxAttempts)).toBe(false);
  });
  it('grows backoff exponentially and caps it', () => {
    const b1 = backoffMs(1);
    const b3 = backoffMs(3);
    expect(b1).toBeGreaterThanOrEqual(RETRY.baseBackoffMs);
    expect(b3).toBeGreaterThan(b1);
    expect(backoffMs(20)).toBeLessThanOrEqual(RETRY.maxBackoffMs);
  });
});

describe('daily cap math', () => {
  it('formats the local day as YYYY-MM-DD', () => {
    expect(localDay(new Date(2026, 6, 9, 14, 0, 0).getTime())).toBe('2026-07-09');
  });
  it('takes the min of account ceiling and campaign cap', () => {
    expect(effectiveDailyCap('consumer', null)).toBe(500);
    expect(effectiveDailyCap('workspace', null)).toBe(2000);
    expect(effectiveDailyCap('workspace', 300)).toBe(300);
    expect(effectiveDailyCap('consumer', 900)).toBe(500);
    expect(effectiveDailyCap('unknown', null)).toBe(500);
  });
  it('computes a positive time until next local midnight', () => {
    const ms = msUntilNextLocalMidnight(new Date(2026, 6, 9, 23, 0, 0).getTime());
    expect(ms).toBeGreaterThan(0);
    expect(ms).toBeLessThanOrEqual(60 * 60 * 1000 + 10_000);
  });
});
