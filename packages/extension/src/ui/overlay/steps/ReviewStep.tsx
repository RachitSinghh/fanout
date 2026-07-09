import { useMemo, useState } from 'react';
import { AlertTriangle, Timer, Gauge, ShieldCheck } from 'lucide-react';
import { MIN_SEND_DELAY_MS } from '@fanout/shared';
import { useCampaignStore } from '../../../store/campaignStore';
import { StepLayout } from '../StepLayout';
import { Button, Card, Callout } from '../../components/primitives';
import { renderForRecipient, sendableRecipients, findBlockingTokens } from '../../../services/preview';

export function ReviewStep() {
  const goTo = useCampaignStore((s) => s.goTo);
  const campaign = useCampaignStore((s) => s.campaign);
  const recipients = useCampaignStore((s) => s.recipients);

  const sendable = useMemo(() => sendableRecipients(recipients), [recipients]);
  const blocking = useMemo(
    () => (campaign ? findBlockingTokens(campaign, recipients) : []),
    [campaign, recipients],
  );

  if (!campaign) return null;
  const canSend = sendable.length > 0 && blocking.length === 0;

  return (
    <StepLayout
      footer={
        <>
          <Button variant="secondary" onClick={() => goTo('map')}>
            Back
          </Button>
          <div className="flex items-center gap-3">
            <span className="text-caption text-[var(--text-muted)]">
              {sendable.length} recipient{sendable.length === 1 ? '' : 's'}
            </span>
            <Button disabled={!canSend} onClick={() => goTo('send')}>
              Continue to send
            </Button>
          </div>
        </>
      }
    >
      <h2 className="text-h2">Preview &amp; send options</h2>

      {blocking.length > 0 && <MissingTokenBlock tokens={blocking} />}

      <PreviewPane />

      <div className="mt-6">
        <SendOptions />
      </div>
    </StepLayout>
  );
}

function MissingTokenBlock({ tokens }: { tokens: string[] }) {
  const setTokenFallback = useCampaignStore((s) => s.setTokenFallback);
  const [drafts, setDrafts] = useState<Record<string, string>>({});

  return (
    <Callout tone="warning" icon={<AlertTriangle size={16} />} className="mb-4">
      <p className="text-body-strong">
        Some recipients are missing values for {tokens.length} token
        {tokens.length > 1 ? 's' : ''}.
      </p>
      <p className="mt-1 text-caption">
        Set a fallback so no one receives an empty or literal{' '}
        <span className="font-mono">{'{{token}}'}</span>. You can't send until this
        is resolved.
      </p>
      <div className="mt-3 flex flex-col gap-2">
        {tokens.map((t) => (
          <div key={t} className="flex items-center gap-2">
            <span className="w-32 shrink-0 font-mono text-mono-sm">{`{{${t}}}`}</span>
            <input
              value={drafts[t] ?? ''}
              onChange={(e) => setDrafts((d) => ({ ...d, [t]: e.target.value }))}
              placeholder="fallback, e.g. there"
              className="h-8 flex-1 rounded-md border border-neutral-300 bg-[var(--surface)] px-2 text-body"
            />
            <Button
              size="sm"
              disabled={!drafts[t]?.trim()}
              onClick={() => void setTokenFallback(t, drafts[t]!.trim())}
            >
              Set
            </Button>
          </div>
        ))}
      </div>
    </Callout>
  );
}

function PreviewPane() {
  const campaign = useCampaignStore((s) => s.campaign)!;
  const recipients = useCampaignStore((s) => s.recipients);
  const sendable = useMemo(() => sendableRecipients(recipients), [recipients]);
  const [idx, setIdx] = useState(0);
  const [search, setSearch] = useState('');

  const filtered = search
    ? sendable.filter((r) => r.email.toLowerCase().includes(search.toLowerCase()))
    : sendable;
  const current = filtered[Math.min(idx, Math.max(0, filtered.length - 1))] ?? sendable[0];

  if (!current) {
    return (
      <Callout tone="info">No sendable recipients to preview yet.</Callout>
    );
  }

  const rendered = renderForRecipient(campaign, current);

  return (
    <Card>
      <div className="mb-3 flex items-center justify-between gap-3">
        <h3 className="text-h3">Preview</h3>
        <input
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setIdx(0);
          }}
          placeholder="Search by email…"
          className="h-8 w-48 rounded-md border border-neutral-300 bg-neutral-100 px-2 font-mono text-mono-sm"
        />
      </div>

      {/* Quick sample chips (first 3) */}
      <div className="mb-3 flex flex-wrap gap-1.5">
        {filtered.slice(0, 3).map((r, i) => (
          <button
            key={r.id}
            onClick={() => setIdx(i)}
            className={`rounded-full px-2 py-0.5 font-mono text-caption ${
              current.id === r.id ? 'bg-brand-600 text-white' : 'bg-neutral-100 text-[var(--text-secondary)]'
            }`}
          >
            {r.email}
          </button>
        ))}
        <span className="self-center text-caption text-[var(--text-muted)]">
          {filtered.length} match{filtered.length === 1 ? '' : 'es'}
        </span>
      </div>

      {/* Gmail-like message frame */}
      <div className="rounded-lg border border-[var(--border)]">
        <div className="border-b border-[var(--border)] px-4 py-3">
          <p className="text-body-strong">{rendered.subject || <em className="text-[var(--text-muted)]">(no subject)</em>}</p>
          <p className="mt-1 text-caption text-[var(--text-muted)]">
            From {campaign.fromName || campaign.fromEmail} &lt;{campaign.fromEmail}&gt;
          </p>
          <p className="text-caption text-[var(--text-muted)]">
            To <span className="font-mono">{current.email}</span>
          </p>
        </div>
        <div
          className="prose max-w-none px-4 py-3 text-body"
          // Body is our own template rendered with HTML-escaped token values.
          dangerouslySetInnerHTML={{ __html: rendered.bodyHtml || '<em>(empty body)</em>' }}
        />
      </div>
      <p className="mt-2 flex items-center gap-1 text-caption text-[var(--text-muted)]">
        <ShieldCheck size={12} /> Sent individually — this recipient sees only their
        own address.
      </p>
    </Card>
  );
}

function SendOptions() {
  const campaign = useCampaignStore((s) => s.campaign)!;
  const setThrottle = useCampaignStore((s) => s.setThrottle);
  const setDailyCap = useCampaignStore((s) => s.setDailyCap);
  const throttle = campaign.throttle;

  const minS = Math.round(throttle.minMs / 1000);
  const maxS = Math.round(throttle.maxMs / 1000);
  const invalid = throttle.minMs < MIN_SEND_DELAY_MS || throttle.maxMs < throttle.minMs;

  return (
    <Card>
      <div className="flex items-center gap-2">
        <Timer size={18} className="text-brand-600" />
        <h3 className="text-h3">Delay between sends</h3>
      </div>
      <p className="mt-1 text-body text-[var(--text-secondary)]">
        A randomized pause between each individual send keeps your cadence from
        looking mechanical — an important deliverability safeguard.
      </p>

      <div className="mt-3 flex items-center gap-2">
        <ModeBtn
          active={throttle.mode === 'random'}
          onClick={() => void setThrottle({ ...throttle, mode: 'random' })}
        >
          Randomized
        </ModeBtn>
        <ModeBtn
          active={throttle.mode === 'fixed'}
          onClick={() => void setThrottle({ ...throttle, mode: 'fixed' })}
        >
          Fixed
        </ModeBtn>
      </div>

      <div className="mt-3 flex items-center gap-3">
        <label className="text-label">
          {throttle.mode === 'random' ? 'Min (s)' : 'Delay (s)'}
          <input
            type="number"
            min={MIN_SEND_DELAY_MS / 1000}
            value={minS}
            onChange={(e) =>
              void setThrottle({ ...throttle, minMs: Math.max(0, Number(e.target.value)) * 1000 })
            }
            className="ml-2 h-9 w-20 rounded-md border border-neutral-300 bg-neutral-100 px-3 font-mono text-mono-sm"
          />
        </label>
        {throttle.mode === 'random' && (
          <label className="text-label">
            Max (s)
            <input
              type="number"
              min={minS}
              value={maxS}
              onChange={(e) =>
                void setThrottle({ ...throttle, maxMs: Math.max(0, Number(e.target.value)) * 1000 })
              }
              className="ml-2 h-9 w-20 rounded-md border border-neutral-300 bg-neutral-100 px-3 font-mono text-mono-sm"
            />
          </label>
        )}
      </div>
      {invalid && (
        <p className="mt-2 text-caption text-danger-fg">
          Delay must be at least {MIN_SEND_DELAY_MS / 1000}s, and max ≥ min.
        </p>
      )}

      <div className="mt-5 flex items-center gap-2">
        <Gauge size={18} className="text-brand-600" />
        <h3 className="text-h3">Daily cap</h3>
      </div>
      <p className="mt-1 text-body text-[var(--text-secondary)]">
        Optional. Leave blank to use the safe limit for your account. Fanout
        stops before Gmail's ceiling to protect your account.
      </p>
      <input
        type="number"
        placeholder="Auto (safe default)"
        value={campaign.dailyCap ?? ''}
        onChange={(e) => void setDailyCap(e.target.value ? Number(e.target.value) : null)}
        className="mt-2 h-9 w-40 rounded-md border border-neutral-300 bg-neutral-100 px-3 font-mono text-mono-sm"
      />
    </Card>
  );
}

function ModeBtn({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded-md border px-3 py-1.5 text-label transition-colors ${
        active
          ? 'border-brand-600 bg-brand-50 text-brand-700'
          : 'border-neutral-300 text-[var(--text-secondary)] hover:bg-neutral-50'
      }`}
    >
      {children}
    </button>
  );
}
