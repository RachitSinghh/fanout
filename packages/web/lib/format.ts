/** Shared display formatters for the dashboards (TICKET-042/043). */

export const pct = (n: number, d: number) => (d > 0 ? `${Math.round((n / d) * 100)}%` : '—');

export function fmtDate(d: Date | null | undefined, withYear = false): string {
  if (!d) return '—';
  return d.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    ...(withYear ? { year: 'numeric' } : {}),
  });
}

export const fmtDateTime = (d: Date) =>
  d.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
