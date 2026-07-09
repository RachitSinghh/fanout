import type { ThrottleConfig } from '@fanout/shared';

/**
 * Compute the delay before the next send. Randomized mode returns a jittered
 * value in [minMs, maxMs] so the cadence isn't mechanical (ARCHITECTURE §7.2).
 */
export function nextDelayMs(throttle: ThrottleConfig): number {
  if (throttle.mode === 'fixed') return Math.max(0, throttle.minMs);
  const lo = Math.max(0, Math.min(throttle.minMs, throttle.maxMs));
  const hi = Math.max(throttle.minMs, throttle.maxMs);
  return Math.round(lo + Math.random() * (hi - lo));
}
