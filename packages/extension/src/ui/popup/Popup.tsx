import { useEffect, useState } from 'react';
import { LogIn, ShieldCheck, Send, Inbox, Download } from 'lucide-react';
import type { Campaign } from '@fanout/shared';
import { useAuthStore } from '../../store/authStore';
import { sendToWorker } from '../../messaging/channel';
import { dbClient } from '../../services/dbClient';
import { downloadResultsCsv } from '../../services/csvExport';
import { Button, Card, Callout, Badge, Wordmark } from '../components/primitives';

export function Popup() {
  const { status, identity, error, hydrate, connect, disconnect } = useAuthStore();

  useEffect(() => {
    void hydrate();
  }, [hydrate]);

  return (
    <div className="flex min-h-[480px] max-h-[600px] w-[400px] flex-col overflow-y-auto bg-[var(--surface-sunken)] p-4">
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

function StartCampaignCard() {
  const [hint, setHint] = useState<string>('');

  async function openInGmail() {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab?.id && tab.url?.startsWith('https://mail.google.com/')) {
      await chrome.tabs.sendMessage(tab.id, { type: 'OPEN_OVERLAY' });
      window.close();
    } else {
      await chrome.tabs.create({ url: 'https://mail.google.com/mail/u/0/#inbox?compose=new' });
      setHint('Opened Gmail — click “◆ Bulk Personalize” in the compose window.');
    }
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

function RecentCampaigns() {
  const [campaigns, setCampaigns] = useState<Campaign[] | null>(null);

  useEffect(() => {
    void dbClient.listCampaigns().then((list) =>
      // Only surface campaigns that actually started or finished.
      setCampaigns(list.filter((c) => c.status !== 'draft')),
    );
  }, []);

  async function exportCampaign(c: Campaign) {
    const recipients = await dbClient.listRecipients(c.id);
    downloadResultsCsv(c, recipients);
  }

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
              className="flex items-center justify-between gap-2 rounded-md border border-[var(--border)] p-2"
            >
              <div className="min-w-0">
                <p className="truncate text-body-strong">{c.name}</p>
                <p className="font-tnum text-caption text-[var(--text-muted)]">
                  {c.sentCount}/{c.totalRecipients} sent
                  {c.failedCount > 0 ? ` · ${c.failedCount} failed` : ''}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <Badge tone={STATUS_TONE[c.status] ?? 'neutral'}>{c.status}</Badge>
                <button
                  aria-label="Export CSV"
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
