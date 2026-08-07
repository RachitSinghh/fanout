import { useEffect, useState } from 'react';
import { LogIn, ShieldCheck, Send, Inbox, Download, ChevronLeft } from 'lucide-react';
import type { Campaign } from '@fanout/shared';
import { useAuthStore } from '../../store/authStore';
import { useEntitlementStore } from '../../store/entitlementStore';
import { sendToWorker } from '../../messaging/channel';
import { dbClient } from '../../services/dbClient';
import { downloadResultsCsv } from '../../services/csvExport';
import { Button, Card, Callout, Badge, Wordmark } from '../components/primitives';

export function Popup() {
  const { status, identity, error, hydrate, connect, disconnect } = useAuthStore();
  const loadEntitlement = useEntitlementStore((s) => s.load);

  useEffect(() => {
    void hydrate();
    void loadEntitlement();
  }, [hydrate, loadEntitlement]);

  return (
    <div className="flex min-h-[480px] max-h-[600px] w-[400px] flex-col overflow-y-auto bg-[var(--surface)] p-4">
      <header className="mb-4 flex items-center justify-between">
        <Wordmark className="text-h2" />
        {status === 'connected' && <Badge tone="success">Connected</Badge>}
      </header>

      {status === 'connected' && identity ? (
        <ConnectedView email={identity.email} onDisconnect={disconnect} />
      ) : (
        <DisconnectedView
          connecting={status === 'connecting'}
          error={error}
          onConnect={connect}
        />
      )}
    </div>
  );
}

function DisconnectedView({
  connecting,
  error,
  onConnect,
}: {
  connecting: boolean;
  error: string | null;
  onConnect: () => void;
}) {
  return (
    <div className="flex flex-1 flex-col gap-4">
      <Card roomy>
        <h1 className="text-h1">Send personalized email, individually.</h1>
        <p className="mt-2 text-body text-[var(--text-secondary)]">
          Fanout sends each recipient their own 1:1 message from your Gmail — no
          shared To/CC, real personalization, throttled to protect your account.
        </p>
        <Button
          className="mt-4 w-full"
          size="lg"
          leadingIcon={<LogIn size={18} />}
          loading={connecting}
          onClick={onConnect}
        >
          Connect Gmail
        </Button>
        {error && (
          <p className="mt-2 text-caption text-danger-fg">{error}</p>
        )}
      </Card>

      <Callout tone="info" icon={<ShieldCheck size={16} />}>
        Fanout only asks to <strong>send</strong> mail — never to read your inbox.
        Your recipients never leave this browser.
      </Callout>
    </div>
  );
}

function ConnectedView({
  email,
  onDisconnect,
}: {
  email: string;
  onDisconnect: () => void;
}) {
  return (
    <div className="flex flex-1 flex-col gap-4">
      <Card>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-overline uppercase text-[var(--text-muted)]">
              Sending as
            </p>
            <p className="font-mono text-mono-sm text-[var(--text-primary)]">{email}</p>
            <PlanLabel />
          </div>
          <Button variant="ghost" size="sm" onClick={onDisconnect}>
            Disconnect
          </Button>
        </div>
      </Card>

      <StartCampaignCard />

      <RecentCampaigns />
      <TestSend />
    </div>
  );
}

function PlanLabel() {
  const tier = useEntitlementStore((s) => s.entitlement?.tier);
  if (!tier) return null;
  return <p className="mt-0.5 text-caption capitalize text-brand-400">{tier} plan</p>;
}

function StartCampaignCard() {
  const [hint, setHint] = useState<string>('');

  async function openInGmail() {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab?.id && tab.url?.startsWith('https://mail.google.com/')) {
      try {
        await chrome.tabs.sendMessage(tab.id, { type: 'OPEN_OVERLAY' });
        window.close();
        return;
      } catch {
        // Content script isn't live in that tab — usually a Gmail tab that was
        // open before the extension (re)loaded, so its content script is orphaned.
        await chrome.tabs.update(tab.id, { active: true });
        setHint('Refresh this Gmail tab, then click Bulk Personalize.');
        return;
      }
    }
    await chrome.tabs.create({ url: 'https://mail.google.com/mail/u/0/#inbox?compose=new' });
    setHint('Opened Gmail — click “Bulk Personalize” in the compose window.');
  }

  return (
    <Card>
      <h2 className="text-h2">Start a campaign</h2>
      <p className="mt-1 text-body text-[var(--text-secondary)]">
        Open Gmail, compose a message, and click{' '}
        <span className="font-medium text-brand-600">Bulk Personalize</span> — or
        launch Fanout directly.
      </p>
      <Button className="mt-3" size="md" onClick={openInGmail}>
        Open in Gmail
      </Button>
      {hint && <p className="mt-2 text-caption text-[var(--text-muted)]">{hint}</p>}
    </Card>
  );
}

const STATUS_TONE: Record<string, 'success' | 'warning' | 'danger' | 'info' | 'neutral'> = {
  completed: 'success',
  sending: 'info',
  paused: 'warning',
  cancelled: 'neutral',
  failed: 'danger',
  draft: 'neutral',
  ready: 'neutral',
};

function whenLabel(ms: number | null | undefined): string {
  if (!ms) return 'a scheduled time';
  return new Date(ms).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function rowSubtitle(c: Campaign): string {
  if (c.status === 'scheduled') return `Scheduled · ${whenLabel(c.scheduledAt)}`;
  const failed = c.failedCount > 0 ? ` · ${c.failedCount} failed` : '';
  return `${c.sentCount}/${c.totalRecipients} sent${failed}`;
}

async function exportCampaign(c: Campaign) {
  const recipients = await dbClient.listRecipients(c.id);
  downloadResultsCsv(c, recipients);
}

/** Re-renders every second while `active`, so callers can show a live countdown. */
function useTick(active: boolean): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [active]);
  return now;
}

function formatCountdown(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}h ${String(m).padStart(2, '0')}m`;
  if (m > 0) return `${m}m ${String(sec).padStart(2, '0')}s`;
  return `${sec}s`;
}

/** Live "starts in …" countdown to a scheduled campaign's start (TICKET-016). */
function ScheduledCountdown({ at }: { at: number | null }) {
  const now = useTick(true);
  if (!at) return <p className="mt-0.5 text-caption text-brand-400">Scheduled</p>;
  const remaining = at - now;
  return (
    <p className="mt-0.5 font-tnum text-caption text-brand-400">
      {remaining > 0 ? `Starts in ${formatCountdown(remaining)}` : 'Starting…'} · {whenLabel(at)}
    </p>
  );
}

function RecentCampaigns() {
  const [campaigns, setCampaigns] = useState<Campaign[] | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    const load = () =>
      void dbClient.listCampaigns().then((list) => {
        // Only surface campaigns that actually started, scheduled, or finished.
        if (alive) setCampaigns(list.filter((c) => c.status !== 'draft' && c.status !== 'ready'));
      });
    load();
    // Live-refresh while the popup is open so a sending/scheduled batch updates
    // its counts here — no need to keep the Gmail overlay open (TICKET-016 UX).
    const id = setInterval(load, 2000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, []);

  const selected = selectedId ? campaigns?.find((c) => c.id === selectedId) ?? null : null;
  if (selected) return <CampaignReport campaign={selected} onBack={() => setSelectedId(null)} />;

  return (
    <Card>
      <h2 className="mb-2 text-h2">Recent campaigns</h2>
      {campaigns === null ? (
        <p className="py-4 text-center text-caption text-[var(--text-muted)]">Loading…</p>
      ) : campaigns.length === 0 ? (
        <div className="flex flex-col items-center gap-1 py-6 text-center">
          <Inbox className="text-[var(--text-muted)]" size={24} />
          <p className="text-body text-[var(--text-secondary)]">No campaigns yet</p>
          <p className="text-caption text-[var(--text-muted)]">
            Your sent batches will show up here.
          </p>
        </div>
      ) : (
        <ul className="flex flex-col gap-2">
          {campaigns.slice(0, 8).map((c) => (
            <li
              key={c.id}
              className="flex items-center justify-between gap-2 rounded-md border border-[var(--border)] transition-colors hover:border-[var(--border-strong)]"
            >
              <button
                onClick={() => setSelectedId(c.id)}
                className="flex min-w-0 flex-1 flex-col items-start gap-0.5 p-2 text-left"
              >
                <span className="max-w-full truncate text-body-strong">{c.name}</span>
                <span className="font-tnum text-caption text-[var(--text-muted)]">{rowSubtitle(c)}</span>
              </button>
              <div className="flex shrink-0 items-center gap-2 pr-2">
                <Badge tone={STATUS_TONE[c.status] ?? 'neutral'}>{c.status}</Badge>
                <button
                  aria-label="Export CSV"
                  title="Export CSV"
                  onClick={() => void exportCampaign(c)}
                  className="text-[var(--text-muted)] hover:text-brand-600"
                >
                  <Download size={16} />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

/** Compact per-campaign summary, opened from a Recent-campaigns row (TICKET-016). */
function CampaignReport({ campaign, onBack }: { campaign: Campaign; onBack: () => void }) {
  const total =
    campaign.totalRecipients || campaign.sentCount + campaign.failedCount + campaign.skippedCount;
  const pct = total > 0 ? Math.round((campaign.sentCount / total) * 100) : 0;

  return (
    <Card>
      <div className="flex items-center justify-between">
        <button
          onClick={onBack}
          className="inline-flex items-center gap-1 text-caption text-[var(--text-muted)] hover:text-brand-600"
        >
          <ChevronLeft size={14} /> Recent campaigns
        </button>
        <Badge tone={STATUS_TONE[campaign.status] ?? 'neutral'}>{campaign.status}</Badge>
      </div>

      <p className="mt-3 truncate text-body-strong">{campaign.name}</p>
      {campaign.status === 'scheduled' && <ScheduledCountdown at={campaign.scheduledAt} />}

      <div className="mt-3 flex items-center gap-4">
        <div
          className="grid h-16 w-16 shrink-0 place-items-center rounded-full"
          style={{ background: `conic-gradient(#E8B04B ${pct * 3.6}deg, var(--border) 0deg)` }}
        >
          <div className="grid h-[52px] w-[52px] place-items-center rounded-full bg-[var(--surface-sunken)]">
            <span className="font-tnum text-caption font-semibold">{pct}%</span>
          </div>
        </div>
        <dl className="flex flex-1 flex-col gap-1.5 text-body">
          <ReportRow label="Sent" value={campaign.sentCount} tone="text-brand-400" />
          <ReportRow
            label="Failed"
            value={campaign.failedCount}
            tone={campaign.failedCount ? 'text-danger-fg' : undefined}
          />
          <ReportRow
            label="Skipped"
            value={campaign.skippedCount}
            tone={campaign.skippedCount ? 'text-warning-fg' : undefined}
          />
        </dl>
      </div>

      <Button
        className="mt-4 w-full"
        variant="secondary"
        size="md"
        leadingIcon={<Download size={16} />}
        onClick={() => void exportCampaign(campaign)}
      >
        Export CSV
      </Button>
    </Card>
  );
}

function ReportRow({ label, value, tone }: { label: string; value: number; tone?: string }) {
  return (
    <div className="flex items-center justify-between">
      <dt className="text-[var(--text-muted)]">{label}</dt>
      <dd className={`font-tnum ${tone ?? 'text-[var(--text-primary)]'}`}>{value}</dd>
    </div>
  );
}

function TestSend() {
  const identity = useAuthStore((s) => s.identity);
  const [state, setState] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const [msg, setMsg] = useState<string>('');

  async function runTest() {
    if (!identity) return;
    setState('sending');
    try {
      await sendToWorker({ type: 'GMAIL_SEND_TEST', to: identity.email });
      setState('sent');
      setMsg('Sent — check your inbox.');
    } catch (e) {
      setState('error');
      setMsg(e instanceof Error ? e.message : 'Failed');
    }
  }

  return (
    <Card>
      <h2 className="text-h2">Verify sending</h2>
      <p className="mt-1 text-body text-[var(--text-secondary)]">
        Send a test email to yourself to confirm everything works.
      </p>
      <Button
        className="mt-3"
        variant="secondary"
        size="md"
        leadingIcon={<Send size={16} />}
        loading={state === 'sending'}
        onClick={runTest}
      >
        Send test to myself
      </Button>
      {state === 'sent' && <p className="mt-2 text-caption text-success-fg">{msg}</p>}
      {state === 'error' && <p className="mt-2 text-caption text-danger-fg">{msg}</p>}
    </Card>
  );
}
