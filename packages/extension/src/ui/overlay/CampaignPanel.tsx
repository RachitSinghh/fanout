import { Fragment, useState } from 'react';
import { m } from 'framer-motion';
import { X, Check, FileText } from 'lucide-react';
import { useCampaignStore, STEP_ORDER, STEP_LABELS, type Step } from '../../store/campaignStore';
import { Wordmark } from '../components/primitives';
import { spring } from '../motion/tokens';
import { ImportStep } from './steps/ImportStep';
import { MapStep } from './steps/MapStep';
import { ReviewStep } from './steps/ReviewStep';
import { SendStep } from './steps/SendStep';
import { ReportStep } from './steps/ReportStep';
import { TemplatesDialog } from './TemplatesDialog';

export function CampaignPanel({ onClose }: { onClose: () => void }) {
  const step = useCampaignStore((s) => s.step);
  const campaign = useCampaignStore((s) => s.campaign);
  const sending = campaign?.status === 'sending';
  const [templatesOpen, setTemplatesOpen] = useState(false);

  return (
    <>
      <header className="shrink-0 border-b border-[var(--border)]">
        {/* Row 1 — brand + actions */}
        <div className="flex h-12 items-center justify-between px-5">
          <Wordmark className="text-h3" />
          <div className="flex items-center gap-1">
            <button
              aria-label="Templates"
              title="Templates"
              onClick={() => setTemplatesOpen(true)}
              disabled={sending}
              className="grid h-8 w-8 place-items-center rounded-md text-[var(--text-secondary)] transition-colors hover:bg-[var(--surface-sunken)] disabled:opacity-40"
            >
              <FileText size={16} />
            </button>
            <button
              aria-label="Close"
              title="Close"
              onClick={onClose}
              disabled={sending}
              className="grid h-8 w-8 place-items-center rounded-md text-[var(--text-muted)] transition-colors hover:bg-[var(--surface-sunken)] disabled:opacity-40"
            >
              <X size={18} />
            </button>
          </div>
        </div>
        {/* Row 2 — full-width animated stepper */}
        <div className="border-t border-[var(--border)] px-5 py-3">
          <Stepper current={step} />
        </div>
      </header>
      <StepRouter step={step} />
      <TemplatesDialog open={templatesOpen} onClose={() => setTemplatesOpen(false)} />
    </>
  );
}

function Stepper({ current }: { current: Step }) {
  const currentIdx = STEP_ORDER.indexOf(current);
  return (
    <nav aria-label="Progress" className="flex items-center">
      {STEP_ORDER.map((s, i) => {
        const done = i < currentIdx;
        const active = i === currentIdx;
        return (
          <Fragment key={s}>
            <div className="flex shrink-0 items-center gap-2">
              <span
                className={`relative grid h-7 w-7 place-items-center rounded-full text-caption font-semibold transition-all duration-300 ${
                  active
                    ? 'bg-brand-600 text-[#131209]'
                    : done
                      ? 'bg-brand-600/20 text-brand-400 ring-1 ring-inset ring-brand-600/30'
                      : 'border border-[var(--border-strong)] bg-[var(--surface-sunken)] text-[var(--text-muted)]'
                }`}
              >
                {/* Active dot gets a soft breathing ring so it reads as "you are here". */}
                {active && (
                  <m.span
                    className="absolute inset-0 rounded-full ring-2 ring-brand-600/40"
                    animate={{ opacity: [0.55, 0, 0.55], scale: [1, 1.4, 1] }}
                    transition={{ duration: 2.2, repeat: Infinity, ease: 'easeInOut' }}
                  />
                )}
                {done ? (
                  <m.span initial={{ scale: 0 }} animate={{ scale: 1 }} transition={spring.snappy}>
                    <Check size={13} strokeWidth={3} />
                  </m.span>
                ) : (
                  i + 1
                )}
              </span>
              <span
                className={`text-sm transition-colors duration-300 ${
                  active
                    ? 'font-semibold text-[var(--text-primary)]'
                    : done
                      ? 'text-[var(--text-secondary)]'
                      : 'text-[var(--text-muted)]'
                }`}
              >
                {STEP_LABELS[s]}
              </span>
            </div>
            {i < STEP_ORDER.length - 1 && (
              <div
                className="mx-3 h-px min-w-[16px] flex-1 overflow-hidden rounded-full bg-[var(--border)]"
                aria-hidden
              >
                <m.div
                  className="h-full rounded-full bg-brand-600"
                  initial={false}
                  animate={{ width: i < currentIdx ? '100%' : '0%' }}
                  transition={spring.gentle}
                />
              </div>
            )}
          </Fragment>
        );
      })}
    </nav>
  );
}

function StepRouter({ step }: { step: Step }) {
  switch (step) {
    case 'import':
      return <ImportStep />;
    case 'map':
      return <MapStep />;
    case 'review':
      return <ReviewStep />;
    case 'send':
      return <SendStep />;
    case 'report':
      return <ReportStep />;
  }
}
