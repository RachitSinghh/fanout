import { useEffect, useMemo, useState } from 'react';
import { Download, RotateCw, CheckCircle2 } from 'lucide-react';
import type { RecipientStatus } from '@fanout/shared';
import { useCampaignStore } from '../../../store/campaignStore';
import { useSendStatusStore } from '../../../store/sendStatusStore';
import { StepLayout } from '../StepLayout';
import { Button, Card, Callout } from '../../components/primitives';
import { RecipientTable } from '../../components/RecipientTable';
import { downloadResultsCsv } from '../../../services/csvExport';

type Filter = 'all' | RecipientStatus;

export function ReportStep() {
  const campaign = useCampaignStore((s) => s.campaign);
  const recipients = useCampaignStore((s) => s.recipients);
  const refresh = useCampaignStore((s) => s.refresh);
  const goTo = useCampaignStore((s) => s.goTo);
  const retryFailed = useSendStatusStore((s) => s.retryFailed);
  const [filter, setFilter] = useState<Filter>('all');

  // Pull the final persisted state once the report opens.
  useEffect(() => {
    void refresh();
  }, [refresh]);

  const counts = useMemo(() => {
    const c = { sent: 0, failed: 0, skipped: 0, pending: 0, sending: 0 };
    for (const r of recipients) c[r.status]++;
    return c;
  }, [recipients]);

  const filtered = useMemo(
    () => (filter === 'all' ? recipients : recipients.filter((r) => r.status === filter)),
    [recipients, filter],
  );

  if (!campaign) return null;
  const complete = campaign.status === 'completed';

  async function onRetry() {
    await retryFailed();
    await refresh();
    goTo('send');
  }

  return (
    <StepLayout
      footer={
        <>
          <span className="text-caption text-[var(--text-muted)]">
            {campaign.status === 'completed' ? 'Completed' : `Status: ${campaign.status}`}
          </span>
          <div className="flex gap-2">
            {counts.failed > 0 && (
              <Button variant="secondary" leadingIcon={<RotateCw size={16} />} onClick={onRetry}>
                Retry {counts.failed} failed
              </Button>
            )}
            <Button leadingIcon={<Download size={16} />} onClick={() => downloadResultsCsv(campaign, recipients)}>
              Export CSV
            </Button>
          </div>
        </>
      }
    >
      {complete && (
        <div className="mb-4 flex items-center gap-2 text-success-fg">
          <CheckCircle2 size={22} />
          <h2 className="text-h2">Campaign complete</h2>
        </div>
      )}

      <div className="grid grid-cols-3 gap-3">
        <StatCard label="Sent" value={counts.sent} color="var(--success-fg)" />
        <StatCard label="Failed" value={counts.failed} color="var(--danger-fg)" />
        <StatCard label="Skipped" value={counts.skipped} color="var(--warning-fg)" />
      </div>

      <Callout tone="info" className="mt-3">
        “Sent” means Gmail accepted the message. Delivery and bounces are
        best-effort in this version — a sent message may still bounce later.
      </Callout>

      <div className="mt-4 flex flex-wrap gap-1.5">
        {(['all', 'sent', 'failed', 'skipped', 'pending'] as Filter[]).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`rounded-full px-3 py-1 text-caption capitalize transition-colors ${
              filter === f
                ? 'bg-brand-600 text-white'
                : 'bg-neutral-100 text-[var(--text-secondary)] hover:bg-neutral-200'
            }`}
          >
            {f}
            {f !== 'all' && f in counts ? ` (${counts[f as RecipientStatus]})` : ''}
          </button>
        ))}
      </div>

      <div className="mt-3">
        <RecipientTable recipients={filtered} />
      </div>
    </StepLayout>
  );
}

function StatCard({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <Card>
      <p className="font-tnum text-display" style={{ color }}>
        {value}
      </p>
      <p className="text-overline uppercase text-[var(--text-muted)]">{label}</p>
    </Card>
  );
}
