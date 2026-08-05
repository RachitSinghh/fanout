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
      <header className="flex h-14 shrink-0 items-center justify-between border-b border-[var(--border)] px-6">
        <Wordmark className="text-h3" />
        <Stepper current={step} />
        <div className="flex items-center gap-1">
          <button
            aria-label="Templates"
            onClick={() => setTemplatesOpen(true)}
            disabled={sending}
            className="flex items-center gap-1.5 rounded-md px-2 py-1 text-label text-[var(--text-secondary)] transition-colors hover:bg-neutral-100 disabled:opacity-40"
          >
            <FileText size={16} />
            Templates
          </button>
          <button
            aria-label="Close"
            onClick={onClose}
            disabled={sending}
            className="rounded-md p-1 text-[var(--text-muted)] transition-colors hover:bg-neutral-100 disabled:opacity-40"
          >
            <X size={20} />
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
    <nav aria-label="Progress" className="flex items-center gap-1.5">
      {STEP_ORDER.map((s, i) => {
        const done = i < currentIdx;
        const active = i === currentIdx;
        return (
          <div key={s} className="flex items-center gap-1.5">
            <span
              className={`flex items-center gap-1.5 rounded-full px-2 py-0.5 text-caption ${
                active
                  ? 'bg-brand-50 text-brand-700'
                  : done
                    ? 'text-success-fg'
                    : 'text-[var(--text-muted)]'
              }`}
            >
              <span
                className={`flex h-4 w-4 items-center justify-center rounded-full text-[10px] ${
                  active ? 'bg-brand-600 text-white' : done ? 'bg-success-fg text-white' : 'bg-neutral-200 text-[var(--text-muted)]'
                }`}
              >
                {done ? <Check size={10} /> : i + 1}
              </span>
              {STEP_LABELS[s]}
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
