/**
 * Pure scheduling helpers for the send engine (TICKET-016). Kept free of Dexie
 * and chrome APIs so they're unit-testable in isolation.
 */

/**
 * Split scheduled campaigns into those whose time has arrived (`due`) and the
 * soonest still-future time (`nextAt`). The engine uses `due` to promote sends
 * to `sending` and `nextAt` to re-arm the single wake alarm.
 */
export function partitionDue<T extends { scheduledAt: number | null }>(
  scheduled: T[],
  now: number,
): { due: T[]; nextAt: number | null } {
  const due: T[] = [];
  let nextAt: number | null = null;
  for (const c of scheduled) {
    if (c.scheduledAt == null) continue;
    if (c.scheduledAt <= now) due.push(c);
    else if (nextAt == null || c.scheduledAt < nextAt) nextAt = c.scheduledAt;
  }
  return { due, nextAt };
}
