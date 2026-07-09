import { useRef } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import type { Recipient, RecipientStatus } from '@fanout/shared';

/** Send-status → color mapping (FRONTEND_SPEC §2.3). */
const STATUS_COLOR: Record<RecipientStatus, string> = {
  pending: 'var(--pending-fg)',
  sending: 'var(--brand)',
  sent: 'var(--success-fg)',
  failed: 'var(--danger-fg)',
  skipped: 'var(--warning-fg)',
};

/** Virtualized recipient list — handles thousands of rows without jank. */
export function RecipientTable({ recipients }: { recipients: Recipient[] }) {
  const parentRef = useRef<HTMLDivElement>(null);
  const virt = useVirtualizer({
    count: recipients.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 44,
    overscan: 12,
  });

  if (recipients.length === 0) {
    return (
      <p className="rounded-lg border border-[var(--border)] p-4 text-center text-body text-[var(--text-muted)]">
        No recipients match this filter.
      </p>
    );
  }

  return (
    <div className="overflow-hidden rounded-lg border border-[var(--border)]">
      <div className="flex items-center gap-3 border-b border-[var(--border)] bg-[var(--surface-sunken)] px-3 py-2 text-overline uppercase text-[var(--text-muted)]">
        <span className="w-24">Status</span>
        <span className="flex-1">Email</span>
        <span className="flex-1">Detail</span>
      </div>
      <div ref={parentRef} className="max-h-[320px] overflow-y-auto">
        <div style={{ height: virt.getTotalSize(), position: 'relative' }}>
          {virt.getVirtualItems().map((vi) => {
            const r = recipients[vi.index]!;
            return (
              <div
                key={r.id}
                className="absolute left-0 flex w-full items-center gap-3 border-b border-[var(--border)] px-3 text-body"
                style={{ top: vi.start, height: vi.size }}
              >
                <span className="flex w-24 items-center gap-1.5">
                  <span
                    className="h-2 w-2 shrink-0 rounded-full"
                    style={{ background: STATUS_COLOR[r.status] }}
                  />
                  <span className="text-caption capitalize text-[var(--text-secondary)]">
                    {r.status}
                  </span>
                </span>
                <span className="flex-1 truncate font-mono text-mono-sm">{r.email || '—'}</span>
                <span className="flex-1 truncate text-caption text-[var(--text-muted)]">
                  {r.lastError ?? r.skipReason ?? (r.gmailMessageId ? 'Delivered to Gmail' : '')}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
