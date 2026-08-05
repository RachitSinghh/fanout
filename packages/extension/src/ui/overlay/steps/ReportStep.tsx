import { useEffect, useMemo, useState } from 'react';
import { m } from 'framer-motion';
import { Download, RotateCw, CheckCircle2, XCircle, Timer } from 'lucide-react';
import type { RecipientStatus } from '@fanout/shared';
import { useCampaignStore } from '../../../store/campaignStore';
import { useSendStatusStore } from '../../../store/sendStatusStore';
import { StepLayout } from '../StepLayout';
import { Button, Callout } from '../../components/primitives';
import { RecipientTable } from '../../components/RecipientTable';
import { downloadResultsCsv } from '../../../services/csvExport';
import { spring } from '../../motion/tokens';

type Filter = 'all' | RecipientStatus;

/** Elapsed send time, formatted like the landing "2h 41m". */
function formatDuration(ms: number): string {
  const s = Math.max(0, Math.round(ms / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${sec}s`;
  return `${sec}s`;
}

export function ReportStep() {
  const campaign = useCampaignStore((s) => s.campaign);
  const recipients = useCampaignStore((s) => s.recipients);
  const refresh = useCampaignStore((s) => s.refresh);
  const goTo = useCampaignStore((s) => s.goTo);
  const retryFailed = useSendStatusStore((s) => s.retryFailed);
  const progress = useSendStatusStore((s) => s.progress);
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
  const total = recipients.length;
  const pct = total > 0 ? counts.sent / total : 0;

  const end = campaign.completedAt ?? campaign.updatedAt;
  const elapsed = formatDuration(end - campaign.createdAt);

  const dailyCount = progress?.dailyCount ?? counts.sent;
  const dailyCap = progress?.dailyCap ?? campaign.dailyCap ?? null;
  const capRatio = dailyCap && dailyCap > 0 ? Math.min(1, dailyCount / dailyCap) : 0;

  const hasDetail = counts.failed > 0 || counts.skipped > 0;

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
            {complete ? 'Campaign complete' : `Status: ${campaign.status}`}
          </span>
          {counts.failed > 0 ? (
            <Button variant="secondary" leadingIcon={<RotateCw size={16} />} onClick={onRetry}>
              Retry {counts.failed} failed
            </Button>
          ) : (
            <span className="text-caption text-[var(--text-muted)]">
              {counts.sent} of {total} delivered
            </span>
          )}
        </>
      }
    >
      <h2 className="text-xl font-semibold">
        {complete ? 'Campaign complete' : 'Campaign report'}
      </h2>
      <p className="mt-2 text-body text-[var(--text-secondary)]">
        Every message left from your own Gmail, one at a time.
      </p>

      <div className="mt-6 grid grid-cols-[auto_1fr] items-center gap-8">
        <Donut pct={pct} />
        <div className="flex flex-col gap-3">
          <StatRow
            icon={<CheckCircle2 size={16} className="text-brand-400" />}
            label="Sent"
            value={String(counts.sent)}
          />
          <StatRow
            icon={<XCircle size={16} className={counts.failed ? 'text-danger-fg' : 'text-[var(--text-muted)]'} />}
            label="Failed"
            value={String(counts.failed)}
          />
          <StatRow
            icon={<Timer size={16} className="text-[var(--text-muted)]" />}
            label="Elapsed"
            value={elapsed}
          />
          <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-sunken)] px-4 py-3">
            <div className="flex items-center justify-between text-body text-[var(--text-secondary)]">
              <span>Daily cap used</span>
              <span className="font-tnum text-[var(--text-muted)]">
                {dailyCount} / {dailyCap ?? '—'}
              </span>
            </div>
            <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-[var(--surface)]">
              <div
                className="h-full rounded-full bg-brand-600"
                style={{ width: `${Math.round(capRatio * 100)}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      <button
        onClick={() => downloadResultsCsv(campaign, recipients)}
        className="mt-6 inline-flex items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--surface-sunken)] px-3 py-2 text-body font-semibold text-[var(--text-secondary)] transition-colors hover:border-[var(--border-strong)] hover:text-[var(--text-primary)]"
      >
        <Download size={16} /> Export report
      </button>

      {/* Detail table only appears when there's something to inspect — a clean
          100% run stays as pristine as the landing slide. */}
      {hasDetail && (
        <div className="mt-8">
          <Callout tone="info" className="mb-3">
            “Sent” means Gmail accepted the message. Delivery and bounces are
            best-effort — a sent message may still bounce later.
          </Callout>
          <div className="mb-3 flex flex-wrap gap-1.5">
            {(['all', 'sent', 'failed', 'skipped', 'pending'] as Filter[]).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`rounded-full px-3 py-1 text-caption capitalize transition-colors ${
                  filter === f
                    ? 'bg-brand-600 text-white'
                    : 'bg-[var(--surface-sunken)] text-[var(--text-secondary)] hover:bg-[var(--surface-raised)]'
                }`}
              >
                {f}
                {f !== 'all' && f in counts ? ` (${counts[f as RecipientStatus]})` : ''}
              </button>
            ))}
          </div>
          <RecipientTable recipients={filtered} />
        </div>
      )}
    </StepLayout>
  );
}

/** Completion ring — the landing report slide's donut. Accent stroke sweeps to `pct`. */
function Donut({ pct }: { pct: number }) {
  const R = 42;
  const C = 2 * Math.PI * R;
  return (
    <div className="relative grid h-40 w-40 place-items-center">
      <svg viewBox="0 0 100 100" className="h-40 w-40 -rotate-90">
        <circle cx="50" cy="50" r={R} fill="none" stroke="var(--border)" strokeWidth="7" />
        <m.circle
          cx="50"
          cy="50"
          r={R}
          fill="none"
          stroke="var(--brand)"
          strokeWidth="7"
          strokeLinecap="round"
          strokeDasharray={C}
          initial={{ strokeDashoffset: C }}
          animate={{ strokeDashoffset: C * (1 - pct) }}
          transition={spring.gentle}
        />
      </svg>
      <div className="absolute text-center">
        <p className="font-tnum text-2xl font-semibold">{Math.round(pct * 100)}%</p>
        <p className="text-caption text-[var(--text-muted)]">delivered</p>
      </div>
    </div>
  );
}

function StatRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center justify-between rounded-xl border border-[var(--border)] bg-[var(--surface-sunken)] px-4 py-3.5">
      <span className="inline-flex items-center gap-2 text-body text-[var(--text-secondary)]">
        {icon} {label}
      </span>
      <span className="font-tnum text-body text-[var(--text-primary)]">{value}</span>
    </div>
  );
}
