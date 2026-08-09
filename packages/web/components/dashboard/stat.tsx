import { Card } from '@/components/ui/card';

/** A single lean stat: label, big number, optional sub-line. Used by the user
 *  and operator dashboards (TICKET-042/043). Industrial by design — no charts. */
export function Stat({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <Card>
      <p className="text-sm text-white/60">{label}</p>
      <p className="mt-2 text-3xl font-semibold tabular-nums text-white">{value}</p>
      {sub && <p className="mt-1 text-xs text-white/40">{sub}</p>}
    </Card>
  );
}
