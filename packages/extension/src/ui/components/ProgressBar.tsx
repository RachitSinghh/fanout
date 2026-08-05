import { m } from 'framer-motion';
import type { ProgressSnapshot } from '../../messaging/channel';
import { spring } from '../motion/tokens';
import { DAILY_CAP_WARN_RATIO } from '@fanout/shared';

/** Live send progress, styled to the landing "Sending campaign" slide:
 *  a gold bar on a dark inset, a "X of Y sent" line, and a slim daily-cap meter.
 *  The bar stays gold on completion — never flips to green. */
export function ProgressBar({ p }: { p: ProgressSnapshot }) {
  const done = p.sent + p.failed + p.skipped;
  const pct = p.total > 0 ? Math.round((done / p.total) * 100) : 0;
  const capRatio = p.dailyCap > 0 ? p.dailyCount / p.dailyCap : 0;
  const capWarn = capRatio >= DAILY_CAP_WARN_RATIO;
  const nextS = p.nextSendInMs != null ? Math.max(1, Math.round(p.nextSendInMs / 1000)) : null;

  return (
    <div>
      <div
        role="progressbar"
        aria-valuenow={p.sent}
        aria-valuemin={0}
        aria-valuemax={p.total}
        className="h-2 w-full overflow-hidden rounded-full bg-[var(--surface-sunken)]"
      >
        <m.div
          className="h-full rounded-full bg-brand-600"
          animate={{ width: `${pct}%` }}
          transition={spring.gentle}
        />
      </div>

      <div className="mt-2 flex items-center justify-between text-caption text-[var(--text-muted)]">
        <span className="font-tnum">
          <span className="text-body-strong text-[var(--text-primary)]">{p.sent}</span> of {p.total} sent
        </span>
        <span className="font-tnum">
          {p.status === 'sending' && nextS != null ? `next in ${nextS}s` : `${pct}%`}
        </span>
      </div>

      {/* Status legend — matches the landing sub-stat row */}
      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 font-tnum text-caption">
        <Stat color="var(--brand)" label="sent" value={p.sent} />
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
        <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-[var(--surface-sunken)]">
          <div
            className="h-full rounded-full"
            style={{
              width: `${Math.min(100, Math.round(capRatio * 100))}%`,
              background: capWarn ? 'var(--warning-fg)' : 'var(--brand)',
            }}
          />
        </div>
        {p.status === 'paused' && p.dailyCount >= p.dailyCap && (
          <p className="mt-1.5 text-caption text-info-fg">
            Daily limit reached — remaining emails will continue tomorrow.
          </p>
        )}
      </div>
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
