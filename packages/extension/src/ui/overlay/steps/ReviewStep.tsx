import { useMemo, useState } from 'react';
import {
  AlertTriangle, Timer, Gauge, ShieldCheck, CheckCircle2, ChevronLeft, ChevronRight,
  Paperclip, FileText, X,
} from 'lucide-react';
import { MIN_SEND_DELAY_MS, MAX_ATTACHMENT_BYTES, type Attachment } from '@fanout/shared';
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
  const attachmentsBytes = (campaign.attachments ?? []).reduce((n, a) => n + a.size, 0);
  const attachmentsOver = attachmentsBytes > MAX_ATTACHMENT_BYTES;
  const canSend = sendable.length > 0 && blocking.length === 0 && !attachmentsOver;

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
      {blocking.length > 0 && <MissingTokenBlock tokens={blocking} />}

      <PreviewPane noMissing={blocking.length === 0} />

      <div className="mt-6">
        <Attachments />
      </div>

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
              className="h-8 flex-1 rounded-md border border-[var(--border)] bg-[var(--surface)] px-2 text-body"
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

function PreviewPane({ noMissing }: { noMissing: boolean }) {
  const campaign = useCampaignStore((s) => s.campaign)!;
  const recipients = useCampaignStore((s) => s.recipients);
  const sendable = useMemo(() => sendableRecipients(recipients), [recipients]);
  const [idx, setIdx] = useState(0);

  const total = sendable.length;
  const clamped = Math.min(idx, Math.max(0, total - 1));
  const current = sendable[clamped];

  if (!current) {
    return <Callout tone="info">No sendable recipients to preview yet.</Callout>;
  }

  const rendered = renderForRecipient(campaign, current);

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="text-xl font-semibold">Preview a real row</h2>
        {noMissing && (
          <span className="ml-auto inline-flex items-center gap-1.5 text-caption text-brand-400">
            <CheckCircle2 size={14} /> No missing values
          </span>
        )}
      </div>

      {/* Pager */}
      <div className="mt-4 flex items-center gap-3 text-body">
        <button
          aria-label="Previous recipient"
          onClick={() => setIdx((i) => Math.max(0, i - 1))}
          disabled={clamped === 0}
          className="grid h-8 w-8 place-items-center rounded-lg border border-[var(--border)] bg-[var(--surface)] text-[var(--text-secondary)] transition-colors hover:border-[var(--border-strong)] disabled:opacity-40"
        >
          <ChevronLeft size={16} />
        </button>
        <span className="font-tnum text-[var(--text-secondary)]">
          {clamped + 1} of {total}
        </span>
        <button
          aria-label="Next recipient"
          onClick={() => setIdx((i) => Math.min(total - 1, i + 1))}
          disabled={clamped >= total - 1}
          className="grid h-8 w-8 place-items-center rounded-lg border border-[var(--border)] bg-[var(--surface)] text-[var(--text-secondary)] transition-colors hover:border-[var(--border-strong)] disabled:opacity-40"
        >
          <ChevronRight size={16} />
        </button>
        <span className="ml-1 truncate rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 font-mono text-mono-sm text-[var(--text-secondary)]">
          {current.email}
        </span>
      </div>

      {/* Rendered message */}
      <div className="mt-4 rounded-xl border border-[var(--border)] bg-[var(--surface-sunken)] p-5">
        <p className="text-caption text-[var(--text-muted)]">Subject</p>
        <p className="mt-1 text-body-strong">
          {rendered.subject || <span className="text-[var(--text-muted)]">(no subject)</span>}
        </p>
        <p className="mt-1 text-caption text-[var(--text-muted)]">
          To <span className="font-mono">{current.email}</span> · from{' '}
          {campaign.fromName || campaign.fromEmail}
        </p>
        <div
          className="mt-4 max-w-none text-body leading-relaxed text-[var(--text-secondary)]"
          // Body is our own template rendered with HTML-escaped token values.
          dangerouslySetInnerHTML={{ __html: rendered.bodyHtml || '<em>(empty body)</em>' }}
        />
      </div>

      <p className="mt-2 flex items-center gap-1.5 text-caption text-[var(--text-muted)]">
        <ShieldCheck size={12} /> Sent individually — this recipient sees only their own address.
      </p>
    </div>
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
        <Timer size={18} className="text-brand-400" />
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
            className="ml-2 h-9 w-20 rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 font-mono text-mono-sm"
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
              className="ml-2 h-9 w-20 rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 font-mono text-mono-sm"
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
        <Gauge size={18} className="text-brand-400" />
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
        className="mt-2 h-9 w-40 rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 font-mono text-mono-sm"
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
          ? 'border-brand-600/50 bg-brand-600/15 text-brand-400'
          : 'border-[var(--border)] text-[var(--text-secondary)] hover:bg-[var(--surface-sunken)]'
      }`}
    >
      {children}
    </button>
  );
}

/** Read a picked File into a base64 Attachment (stored on the campaign). */
async function fileToAttachment(file: File): Promise<Attachment> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return {
    name: file.name,
    mimeType: file.type || 'application/octet-stream',
    size: file.size,
    data: btoa(binary),
  };
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

/** Files attached to every send in the campaign (TICKET-018). */
function Attachments() {
  const campaign = useCampaignStore((s) => s.campaign)!;
  const setAttachments = useCampaignStore((s) => s.setAttachments);
  const files = campaign.attachments ?? [];
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const totalBytes = files.reduce((n, a) => n + a.size, 0);
  const over = totalBytes > MAX_ATTACHMENT_BYTES;

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const picked = Array.from(e.target.files ?? []);
    e.target.value = ''; // let the same file be re-picked after removal
    if (picked.length === 0) return;
    setBusy(true);
    setError(null);
    try {
      const added = await Promise.all(picked.map(fileToAttachment));
      // Re-adding a file with the same name replaces it (no silent duplicates).
      const byName = new Map(files.map((a) => [a.name, a] as const));
      for (const a of added) byName.set(a.name, a);
      await setAttachments([...byName.values()]);
    } catch {
      setError('Could not read one of those files. Try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <div className="flex items-center gap-2">
        <Paperclip size={18} className="text-brand-400" />
        <h3 className="text-h3">Attachments</h3>
      </div>
      <p className="mt-1 text-body text-[var(--text-secondary)]">
        Optional. Files added here go out with <em>every</em> recipient's individual email.
      </p>

      {files.length > 0 && (
        <ul className="mt-3 flex flex-col gap-2">
          {files.map((a) => (
            <li
              key={a.name}
              className="flex items-center gap-2 rounded-md border border-[var(--border)] bg-[var(--surface-sunken)] px-3 py-2"
            >
              <FileText size={16} className="shrink-0 text-[var(--text-muted)]" />
              <span className="min-w-0 flex-1 truncate text-body">{a.name}</span>
              <span className="shrink-0 font-tnum text-caption text-[var(--text-muted)]">
                {formatBytes(a.size)}
              </span>
              <button
                aria-label={`Remove ${a.name}`}
                onClick={() => void setAttachments(files.filter((f) => f.name !== a.name))}
                className="shrink-0 text-[var(--text-muted)] transition-colors hover:text-danger-fg"
              >
                <X size={15} />
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-3 flex items-center gap-3">
        <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-[var(--border-strong)] bg-[var(--surface)] px-3 py-1.5 text-label text-[var(--text-primary)] transition-colors hover:bg-[var(--surface-sunken)]">
          <Paperclip size={14} /> {busy ? 'Reading…' : 'Add files'}
          <input type="file" multiple className="hidden" onChange={onPick} disabled={busy} />
        </label>
        {files.length > 0 && (
          <span className={`font-tnum text-caption ${over ? 'text-danger-fg' : 'text-[var(--text-muted)]'}`}>
            {formatBytes(totalBytes)} / {formatBytes(MAX_ATTACHMENT_BYTES)}
          </span>
        )}
      </div>

      {error && <p className="mt-2 text-caption text-danger-fg">{error}</p>}
      {over && (
        <Callout tone="danger" icon={<AlertTriangle size={16} />} className="mt-3">
          Attachments total {formatBytes(totalBytes)} — over Gmail's ~25&nbsp;MB message
          limit. Remove some before sending.
        </Callout>
      )}
    </Card>
  );
}
