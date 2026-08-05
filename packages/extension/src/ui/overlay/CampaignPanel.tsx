import { useState } from 'react';
import { X, Check, FileText } from 'lucide-react';
import { useCampaignStore, STEP_ORDER, STEP_LABELS, type Step } from '../../store/campaignStore';
import { Wordmark } from '../components/primitives';
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
      <header className="flex h-14 shrink-0 items-center justify-between gap-5 border-b border-[var(--border)] px-6">
        <div className="flex min-w-0 items-center gap-5">
          <Wordmark className="shrink-0 text-h3" />
          <Stepper current={step} />
        </div>
        <div className="flex shrink-0 items-center gap-1 border-l border-[var(--border)] pl-3">
          <button
            aria-label="Templates"
            title="Templates"
            onClick={() => setTemplatesOpen(true)}
            disabled={sending}
            className="grid h-8 w-8 place-items-center rounded-md text-[var(--text-secondary)] transition-colors hover:bg-neutral-100 disabled:opacity-40"
          >
            <FileText size={16} />
          </button>
          <button
            aria-label="Close"
            title="Close"
            onClick={onClose}
            disabled={sending}
            className="grid h-8 w-8 place-items-center rounded-md text-[var(--text-muted)] transition-colors hover:bg-neutral-100 disabled:opacity-40"
          >
            <X size={18} />
          </button>
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
    <nav aria-label="Progress" className="flex items-center gap-2">
      {STEP_ORDER.map((s, i) => {
        const done = i < currentIdx;
        const active = i === currentIdx;
        return (
          <div key={s} className="flex items-center gap-2">
            <span className="flex items-center gap-1.5">
              <span
                className={`grid h-6 w-6 place-items-center rounded-full text-caption font-semibold transition-colors ${
                  active
                    ? 'bg-brand-600 text-[#131209]'
                    : done
                      ? 'bg-brand-600/20 text-brand-400'
                      : 'border border-[var(--border)] bg-[var(--surface-sunken)] text-[var(--text-muted)]'
                }`}
              >
                {done ? <Check size={12} /> : i + 1}
              </span>
              <span
                className={`text-caption transition-colors ${
                  active ? 'text-[var(--text-primary)]' : done ? 'text-[var(--text-secondary)]' : 'text-[var(--text-muted)]'
                }`}
              >
                {STEP_LABELS[s]}
              </span>
            </span>
            {i < STEP_ORDER.length - 1 && (
              <span className="h-px w-3 bg-[var(--border)]" aria-hidden />
            )}
          </div>
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
