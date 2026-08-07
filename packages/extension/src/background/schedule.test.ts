import { describe, it, expect } from 'vitest';
import { partitionDue } from './schedule';

describe('partitionDue', () => {
  const now = 1_000_000;

  it('separates due from future and finds the soonest future', () => {
    const { due, nextAt } = partitionDue(
      [
        { id: 'a', scheduledAt: now - 5 },
        { id: 'b', scheduledAt: now + 100 },
        { id: 'c', scheduledAt: now + 20 },
        { id: 'd', scheduledAt: null },
      ],
      now,
    );
    expect(due.map((c) => c.id)).toEqual(['a']);
    expect(nextAt).toBe(now + 20);
  });

  it('treats scheduledAt exactly now as due', () => {
    const { due, nextAt } = partitionDue([{ scheduledAt: now }], now);
    expect(due).toHaveLength(1);
    expect(nextAt).toBeNull();
  });

  it('returns no due and null next when there is nothing to run', () => {
    expect(partitionDue([], now)).toEqual({ due: [], nextAt: null });
    const future = partitionDue([{ scheduledAt: now + 1 }], now);
    expect(future.due).toHaveLength(0);
    expect(future.nextAt).toBe(now + 1);
  });
});
