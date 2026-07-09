import { m } from 'framer-motion';
import type { ProgressSnapshot } from '../../messaging/channel';
import { spring } from '../motion/tokens';
import { DAILY_CAP_WARN_RATIO } from '@fanout/shared';

/** Live send progress (FRONTEND_SPEC §5.6). Calm, legible, tabular numerals. */
export function ProgressBar({ p }: { p: ProgressSnapshot }) {
  const done = p.sent + p.failed + p.skipped;
  const pct = p.total > 0 ? Math.round((done / p.total) * 100) : 0;
  const complete = p.status === 'completed';
  const capRatio = p.dailyCap > 0 ? p.dailyCount / p.dailyCap : 0;
  const capWarn = capRatio >= DAILY_CAP_WARN_RATIO;

  return (
    <div>
      <div className="flex items-baseline justify-between">
        <p className="font-tnum text-h1">
          {p.sent}
          <span className="text-[var(--text-muted)]"> of {p.total} sent</span>
        </p>
        <span className="text-caption text-[var(--text-muted)]">{pct}%</span>
      </div>

      <div
        role="progressbar"
        aria-valuenow={p.sent}
        aria-valuemin={0}
        aria-valuemax={p.total}
        className="mt-2 h-2 w-full overflow-hidden rounded-full bg-neutral-200"
      >
        <m.div
          className="h-full rounded-full"
          style={{ background: complete ? 'var(--success-fg)' : 'var(--brand)' }}
          animate={{ width: `${pct}%` }}
          transition={spring.gentle}
        />
      </div>

      {/* Sub-stats */}
      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 font-tnum text-caption">
        <Stat color="var(--success-fg)" label="sent" value={p.sent} />
        <Stat color="var(--warning-fg)" label="skipped" value={p.skipped} />
        <Stat color="var(--danger-fg)" label="failed" value={p.failed} />
        <Stat color="var(--pending-fg)" label="queued" value={p.pending + p.sending} />
      </div>

      {/* Daily-cap meter */}
      <div className="mt-4">
        <div className="flex items-center justify-between text-caption text-[var(--text-muted)]">
          <span>Daily sending</span>
          <span className="font-tnum">
            {p.dailyCount} / {p.dailyCap} today
          </span>
        </div>
        <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-neutral-200">
          <div
            className="h-full rounded-full"
            style={{
              width: `${Math.min(100, Math.round(capRatio * 100))}%`,
              background: capWarn ? 'var(--warning-fg)' : 'var(--brand-400)',
            }}
          />
        </div>
        {p.status === 'paused' && p.dailyCount >= p.dailyCap && (
          <p className="mt-1 text-caption text-info-fg">
            Daily limit reached — remaining emails will continue tomorrow.
          </p>
        )}
      </div>

      {p.status === 'sending' && p.nextSendInMs != null && (
        <p className="mt-3 text-caption text-[var(--text-muted)]">
          Sending individually, roughly every {Math.round(p.nextSendInMs / 1000)}s
          (randomized).
        </p>
      )}
    </div>
  );
}

function Stat({ color, label, value }: { color: string; label: string; value: number }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="h-2 w-2 rounded-full" style={{ background: color }} />
      <span className="text-[var(--text-secondary)]">
        {value} {label}
      </span>
    </span>
  );
}
