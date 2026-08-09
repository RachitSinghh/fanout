import { db } from '../db/schema';
import type { AccountType } from '@fanout/shared';
import { dailyCapFor } from '@fanout/shared';

/**
 * Per-account, per-day send counter — the local daily-cap guardrail
 * (TICKET-010). Enforced before any network call, works offline, and survives
 * browser restarts. The counter is keyed to the account's LOCAL calendar day
 * (SECURITY_AND_ACCESS §5.1).
 */

/** Local calendar day as YYYY-MM-DD. */
export function localDay(now = Date.now()): string {
  const d = new Date(now);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function counterId(accountEmail: string, day: string): string {
  return `${accountEmail}:${day}`;
}

export async function getTodayCount(accountEmail: string): Promise<number> {
  const row = await db.sendCounters.get(counterId(accountEmail, localDay()));
  return row?.count ?? 0;
}

/** Atomically increment today's count for the account and return the new total. */
export async function incrementToday(accountEmail: string): Promise<number> {
  const day = localDay();
  const id = counterId(accountEmail, day);
  return db.transaction('rw', db.sendCounters, async () => {
    const existing = await db.sendCounters.get(id);
    const count = (existing?.count ?? 0) + 1;
    await db.sendCounters.put({ id, accountEmail, date: day, count });
    return count;
  });
}

/** Effective daily ceiling: the account-type cap, further limited by the plan's
 *  cap (free tier) and the campaign cap. Any of the limits may be null (no
 *  limit from that source); the smallest that applies wins. */
export function effectiveDailyCap(
  accountType: AccountType,
  campaignCap: number | null,
  planCap: number | null = null,
): number {
  return Math.min(
    dailyCapFor(accountType),
    planCap ?? Infinity,
    campaignCap ?? Infinity,
  );
}

/** Milliseconds until the next local midnight (when the daily allowance resets). */
export function msUntilNextLocalMidnight(now = Date.now()): number {
  const d = new Date(now);
  const next = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1, 0, 0, 5, 0);
  return next.getTime() - now;
}
