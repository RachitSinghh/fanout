import type { AccountType } from '../types/auth';

/**
 * Conservative daily send ceilings by account type (ARCHITECTURE §6,
 * SECURITY_AND_ACCESS §4.3). These protect the user's Gmail account from
 * being flagged/suspended — err low when the account type is unknown.
 */
export const DAILY_CAPS: Record<AccountType, number> = {
  consumer: 500,
  workspace: 2000,
  // When unknown, default to the SAFER lower cap.
  unknown: 500,
};

export function dailyCapFor(accountType: AccountType): number {
  return DAILY_CAPS[accountType];
}

/** Fraction of the daily cap at which we start warning the user. */
export const DAILY_CAP_WARN_RATIO = 0.9;

/** Throttle defaults (ms). Randomized cadence is a deliverability requirement. */
export const DEFAULT_THROTTLE = {
  minMs: 8_000,
  maxMs: 30_000,
  mode: 'random' as const,
};

/** Hard floor on inter-send delay — zero/negative would risk the account. */
export const MIN_SEND_DELAY_MS = 2_000;

/** Retry policy for transient send failures (SECURITY_AND_ACCESS §4.2). */
export const RETRY = {
  maxAttempts: 3,
  baseBackoffMs: 2_000,
  maxBackoffMs: 60_000,
};

/** Upper bound on imported list size for the MVP (SECURITY_AND_ACCESS §5.2). */
export const MAX_RECIPIENTS = 5_000;
