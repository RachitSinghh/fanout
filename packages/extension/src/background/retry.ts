import { RETRY } from '@fanout/shared';

/**
 * Exponential backoff for transient (429 / 5xx) send failures (TICKET-012).
 * attempt is 1-based (the attempt that just failed).
 */
export function backoffMs(attempt: number): number {
  const raw = RETRY.baseBackoffMs * 2 ** Math.max(0, attempt - 1);
  // Add a little jitter so retries don't align across a burst.
  const jitter = Math.random() * RETRY.baseBackoffMs;
  return Math.min(RETRY.maxBackoffMs, raw + jitter);
}

/** True while a transient failure still has retries left. */
export function canRetry(attempts: number): boolean {
  return attempts < RETRY.maxAttempts;
}
