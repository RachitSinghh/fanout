import { useEffect, useMemo, useState } from 'react';
import {
  SendHorizontal, Pause, Play, ShieldCheck, AlertTriangle, XCircle, RotateCw,
  CheckCircle2, Loader2, Clock, MinusCircle, CalendarClock,
} from 'lucide-react';
import type { Recipient, RecipientStatus } from '@fanout/shared';
import { extensionContextAlive } from '../../../messaging/channel';
import { useCampaignStore } from '../../../store/campaignStore';
import { useSendStatusStore } from '../../../store/sendStatusStore';
import { useEntitlementStore } from '../../../store/entitlementStore';
import { useAuthStore } from '../../../store/authStore';
import { StepLayout } from '../StepLayout';
import { Button, Card, Callout } from '../../components/primitives';
import { Dialog } from '../../components/Dialog';
import { DateTimePicker } from '../../components/DateTimePicker';
import { ProgressBar } from '../../components/ProgressBar';
import { sendableRecipients } from '../../../services/preview';

export function SendStep({ onClose }: { onClose: () => void }) {
  const campaign = useCampaignStore((s) => s.campaign);
  const recipients = useCampaignStore((s) => s.recipients);
  const goTo = useCampaignStore((s) => s.goTo);
  const { progress, attach, detach, start, schedule, unschedule, pause, resume, cancel } =
    useSendStatusStore();

  useEffect(() => {
    if (campaign) void attach(campaign.id);
    return () => detach();
  }, [campaign, attach, detach]);

  const sendable = useMemo(() => sendableRecipients(recipients), [recipients]);
  const [confirmSend, setConfirmSend] = useState(false);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [scheduledFor, setScheduledFor] = useState<number | null>(null);

  if (!campaign) return null;

  // Scheduling doesn't need the overlay open — the worker runs it. Show a brief
  // confirmation, then close so the user monitors from the popup (TICKET-016 UX).
  if (scheduledFor != null) return <ScheduledConfirm scheduledAt={scheduledFor} onClose={onClose} />;

  const status = progress?.status ?? campaign.status;

  if (status === 'scheduled') {
    return (
      <Scheduled
        scheduledAt={campaign.scheduledAt}
        count={sendable.length}
        fromEmail={campaign.fromEmail}
        onCancel={async () => {
          await unschedule();
        }}
        onSendNow={async () => {
          await start();
        }}
      />
    );
  }

  const started =
    status === 'sending' ||
    status === 'paused' ||
    status === 'completed' ||
    status === 'cancelled' ||
    status === 'failed';

  if (!started) {
    return (
      <PreSend
        fromEmail={campaign.fromEmail}
        count={sendable.length}
        throttle={campaign.throttle}
        progress={progress}
        confirmOpen={confirmSend}
        onOpenConfirm={() => setConfirmSend(true)}
        onCloseConfirm={() => setConfirmSend(false)}
        onConfirm={async () => {
          setConfirmSend(false);
          await start();
        }}
        onSchedule={async (at) => {
          await schedule(at);
          setScheduledFor(at);
          window.setTimeout(onClose, 2000);
        }}
        onBack={() => goTo('review')}
      />
    );
  }

  return (
    <Sending
      progress={progress}
      throttle={campaign.throttle}
      onPause={pause}
      onResume={resume}
      onViewReport={() => goTo('report')}
      confirmCancelOpen={confirmCancel}
      onOpenCancel={() => setConfirmCancel(true)}
      onCloseCancel={() => setConfirmCancel(false)}
      onConfirmCancel={async () => {
        setConfirmCancel(false);
        await cancel();
      }}
    />
  );
}

function PreSend({
  fromEmail,
  count,
  throttle,
  progress,
  confirmOpen,
  onOpenConfirm,
  onCloseConfirm,
  onConfirm,
  onSchedule,
  onBack,
}: {
  fromEmail: string;
  count: number;
  throttle: { minMs: number; maxMs: number; mode: string };
  progress: ReturnType<typeof useSendStatusStore.getState>['progress'];
  confirmOpen: boolean;
  onOpenConfirm: () => void;
  onCloseConfirm: () => void;
  onConfirm: () => void;
  onSchedule: (scheduledAt: number) => void;
  onBack: () => void;
}) {
  const delayText =
    throttle.mode === 'fixed'
      ? `${Math.round(throttle.minMs / 1000)}s between sends`
      : `${Math.round(throttle.minMs / 1000)}–${Math.round(throttle.maxMs / 1000)}s (randomized) between sends`;

  const remaining = progress ? Math.max(0, progress.dailyCap - progress.dailyCount) : null;
  const exceedsToday = remaining != null && count > remaining;

  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [scheduledAt, setScheduledAt] = useState<number | null>(null);
  const validAt = scheduledAt != null && scheduledAt - Date.now() >= 60_000;
  // Feature gate (TICKET-035); `free` unlocks it at launch so this is true today.
  const canSchedule = useEntitlementStore((s) => s.entitlement?.scheduling ?? true);

  return (
    <StepLayout
      footer={
        <>
          <Button variant="secondary" onClick={onBack}>
            Back
          </Button>
          <div className="flex gap-2">
            <Button
              variant="secondary"
              size="lg"
              aria-label={canSchedule ? 'Schedule for later' : 'Scheduling is a Pro feature'}
              title={canSchedule ? 'Schedule for later' : 'Scheduling is a Pro feature'}
              disabled={count === 0 || !canSchedule}
              onClick={() => setScheduleOpen(true)}
              className="w-11 !px-0"
              leadingIcon={<CalendarClock size={18} />}
            />
            <Button size="lg" leadingIcon={<SendHorizontal size={18} />} disabled={count === 0} onClick={onOpenConfirm}>
              Send {count} email{count === 1 ? '' : 's'}
            </Button>
          </div>
        </>
      }
    >
      <h2 className="text-xl font-semibold">Ready to send</h2>
      <Card className="mt-4">
        <dl className="flex flex-col gap-2.5 text-body">
          <Row label="Recipients">
            <span className="font-tnum">{count}</span> individual emails
          </Row>
          <Row label="From">
            <span className="font-mono text-mono-sm">{fromEmail}</span>
          </Row>
          <Row label="Throttle">{delayText}</Row>
          {progress && (
            <Row label="Sent today">
              <span className="font-tnum">
                {progress.dailyCount} / {progress.dailyCap}
              </span>
            </Row>
          )}
        </dl>
      </Card>

      <Callout tone="info" icon={<ShieldCheck size={16} />} className="mt-3">
        Each recipient gets their own message — no one sees anyone else's address.
      </Callout>

      {exceedsToday && (
        <Callout tone="warning" icon={<AlertTriangle size={16} />} className="mt-3">
          This list ({count}) is larger than today's remaining allowance
          ({remaining}). Fanout will send up to the safe daily limit, then pause
          and continue the rest tomorrow.
        </Callout>
      )}

      <Dialog
        open={confirmOpen}
        onClose={onCloseConfirm}
        icon={<SendHorizontal className="text-brand-400" size={28} />}
        title={`Send ${count} individual email${count === 1 ? '' : 's'}?`}
        actions={
          <>
            <Button variant="secondary" onClick={onCloseConfirm}>
              Cancel
            </Button>
            <Button onClick={onConfirm}>Send now</Button>
          </>
        }
      >
        From <span className="font-mono">{fromEmail}</span>. Each person gets their
        own message, {delayText}.
      </Dialog>

      <Dialog
        open={scheduleOpen}
        onClose={() => setScheduleOpen(false)}
        icon={<CalendarClock className="text-brand-400" size={28} />}
        title="Schedule this send"
        actions={
          <>
            <Button variant="secondary" onClick={() => setScheduleOpen(false)}>
              Cancel
            </Button>
            <Button
              disabled={!validAt}
              onClick={() => {
                if (scheduledAt == null) return;
                setScheduleOpen(false);
                onSchedule(scheduledAt);
              }}
            >
              Schedule
            </Button>
          </>
        }
      >
        Fanout will start sending {count} email{count === 1 ? '' : 's'} automatically at
        the time you pick. Keep this browser open and signed in — sending runs on your
        machine.
        <div className="mt-3">
          <DateTimePicker value={scheduledAt} minMs={Date.now()} onChange={setScheduledAt} />
        </div>
        {scheduledAt != null && !validAt && (
          <p className="mt-2 text-caption text-warning-fg">
            Pick a time at least a minute from now.
          </p>
        )}
      </Dialog>
    </StepLayout>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-[var(--text-muted)]">{label}</dt>
      <dd className="text-right">{children}</dd>
    </div>
  );
}

function formatWhen(ms: number): string {
  return new Date(ms).toLocaleString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

/** Brief "scheduled ✓" beat shown right after scheduling; the overlay then
 *  auto-closes, since the worker runs the send in the background (TICKET-016). */
function ScheduledConfirm({ scheduledAt, onClose }: { scheduledAt: number; onClose: () => void }) {
  return (
    <StepLayout footer={<Button variant="ghost" onClick={onClose}>Close now</Button>}>
      <div className="flex flex-col items-center justify-center gap-3 py-12 text-center">
        <div className="grid h-14 w-14 place-items-center rounded-full bg-brand-600/15 text-brand-400">
          <CheckCircle2 size={30} />
        </div>
        <h2 className="text-xl font-semibold">Scheduled</h2>
        <p className="max-w-[44ch] text-body text-[var(--text-secondary)]">
          Fanout will start sending at{' '}
          <span className="text-brand-400">{formatWhen(scheduledAt)}</span>. It runs in the
          background — you can close this and track progress from the Fanout icon in your toolbar.
        </p>
      </div>
    </StepLayout>
  );
}

/** A campaign queued to auto-start later (TICKET-016). Cancelable before it fires. */
function Scheduled({
  scheduledAt,
  count,
  fromEmail,
  onCancel,
  onSendNow,
}: {
  scheduledAt: number | null;
  count: number;
  fromEmail: string;
  onCancel: () => void;
  onSendNow: () => void;
}) {
  // "Send now instead" is confirmed, never a direct fire — a stray click right
  // after Schedule (the button lands where "Schedule" just was) must not blast the
  // campaign early. It opens this dialog instead (root-caused, TICKET-016).
  const [confirmNow, setConfirmNow] = useState(false);
  const whenText = scheduledAt ? formatWhen(scheduledAt) : 'the scheduled time';

  return (
    <StepLayout
      footer={
        <>
          <Button variant="ghost" onClick={() => setConfirmNow(true)}>
            Send now instead
          </Button>
          <Button leadingIcon={<CalendarClock size={16} />} onClick={onCancel}>
            Cancel schedule
          </Button>
        </>
      }
    >
      <div className="flex items-center gap-2">
        <h2 className="text-xl font-semibold">Scheduled</h2>
        <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--border-strong)] px-2 py-0.5 text-caption text-brand-400">
          <CalendarClock size={13} /> waiting
        </span>
      </div>
      <Card className="mt-4">
        <dl className="flex flex-col gap-2.5 text-body">
          <Row label="Sends">
            <span className="font-tnum">{count}</span> individual email{count === 1 ? '' : 's'}
          </Row>
          <Row label="From">
            <span className="font-mono text-mono-sm">{fromEmail}</span>
          </Row>
          <Row label="Starts">
            <span className="font-tnum text-brand-400">{scheduledAt ? formatWhen(scheduledAt) : 'a scheduled time'}</span>
          </Row>
        </dl>
      </Card>

      <Callout tone="info" icon={<CalendarClock size={16} />} className="mt-3">
        Fanout starts automatically at the scheduled time. Keep this browser open and
        signed in — sending runs on your machine, not a server.
      </Callout>

      <Dialog
        open={confirmNow}
        onClose={() => setConfirmNow(false)}
        icon={<SendHorizontal className="text-brand-400" size={28} />}
        title="Send now instead of waiting?"
        actions={
          <>
            <Button variant="secondary" onClick={() => setConfirmNow(false)}>
              Keep schedule
            </Button>
            <Button
              onClick={() => {
                setConfirmNow(false);
                onSendNow();
              }}
            >
              Send now
            </Button>
          </>
        }
      >
        This cancels the {whenText} schedule and starts sending {count} email
        {count === 1 ? '' : 's'} <strong>immediately</strong>.
      </Dialog>
    </StepLayout>
  );
}

function Sending({
  progress,
  throttle,
  onPause,
  onResume,
  onViewReport,
  confirmCancelOpen,
  onOpenCancel,
  onCloseCancel,
  onConfirmCancel,
}: {
  progress: ReturnType<typeof useSendStatusStore.getState>['progress'];
  throttle: { minMs: number; maxMs: number; mode: string };
  onPause: () => void;
  onResume: () => void;
  onViewReport: () => void;
  confirmCancelOpen: boolean;
  onOpenCancel: () => void;
  onCloseCancel: () => void;
  onConfirmCancel: () => void;
}) {
  const connect = useAuthStore((s) => s.connect);
  const status = progress?.status ?? 'sending';
  const pauseReason = progress?.pauseReason ?? null;
  const accountError = progress?.accountStopReason ?? null;
  const isSending = status === 'sending';
  const isPaused = status === 'paused';
  const isTerminal = status === 'completed' || status === 'cancelled' || status === 'failed';
  const accountStopped = isPaused && pauseReason === 'account';
  const authStopped = isPaused && pauseReason === 'auth';

  const title =
    status === 'completed' ? 'Done'
      : status === 'cancelled' ? 'Cancelled'
      : status === 'failed' ? 'Stopped'
      : status === 'paused' ? 'Paused'
      : 'Sending campaign';

  const gapText =
    throttle.mode === 'fixed'
      ? `Fixed ${Math.round(throttle.minMs / 1000)}s gap`
      : `Randomized ${Math.round(throttle.minMs / 1000)} to ${Math.round(throttle.maxMs / 1000)}s gap`;
  const capText = progress ? ` · daily cap ${progress.dailyCount} of ${progress.dailyCap} tracked` : '';

  return (
    <StepLayout
      footer={
        isTerminal ? (
          <>
            <span className="text-caption text-[var(--text-muted)]">
              {status === 'completed' ? 'Campaign complete' : `Campaign ${status}`}
            </span>
            <Button onClick={onViewReport}>View report</Button>
          </>
        ) : (
          <>
            <Button variant="ghost" onClick={onOpenCancel}>
              Cancel
            </Button>
            <div className="flex gap-2">
              {isPaused && !accountStopped && !authStopped && (
                <Button leadingIcon={<Play size={16} />} onClick={onResume}>
                  Resume
                </Button>
              )}
              {isSending && (
                <Button variant="secondary" leadingIcon={<Pause size={16} />} onClick={onPause}>
                  Pause
                </Button>
              )}
              <Button variant="ghost" onClick={onViewReport}>
                View report
              </Button>
            </div>
          </>
        )
      }
    >
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">{title}</h2>
        {isSending && (
          <span className="inline-flex items-center gap-1.5 text-caption text-brand-400">
            <span className="h-2 w-2 rounded-full bg-brand-600 animate-pulse" /> live
          </span>
        )}
      </div>

      <div className="mt-4">
        {progress ? <ProgressBar p={progress} /> : <p className="text-body text-[var(--text-muted)]">Starting…</p>}
      </div>

      <RecipientFeed active={isSending || isPaused} />

      <p className="mt-4 text-caption text-[var(--text-muted)]">
        {gapText}{capText}
      </p>

      {(isSending || isPaused) && (
        <p className="mt-2 text-caption text-[var(--text-muted)]">
          Runs in the background — you can close this and track it from the Fanout icon.
        </p>
      )}

      {accountStopped && (
        <Callout tone="danger" icon={<XCircle size={16} />} className="mt-4">
          <p className="text-body-strong">Sending stopped to protect your Gmail account.</p>
          <p className="mt-1 text-caption">
            {accountError ?? 'Google flagged this account or a limit was hit.'} We
            won't retry automatically. Review the report and try again later.
          </p>
        </Callout>
      )}

      {authStopped && (
        <Callout tone="warning" icon={<AlertTriangle size={16} />} className="mt-4">
          <p className="text-body-strong">Google access was removed.</p>
          <p className="mt-1 text-caption">Reconnect to resume where it stopped.</p>
          <Button className="mt-2" size="sm" leadingIcon={<RotateCw size={14} />} onClick={connect}>
            Reconnect
          </Button>
        </Callout>
      )}

      <Dialog
        open={confirmCancelOpen}
        onClose={onCloseCancel}
        icon={<XCircle className="text-danger-fg" size={28} />}
        title="Stop sending?"
        actions={
          <>
            <Button variant="secondary" onClick={onCloseCancel}>
              Keep sending
            </Button>
            <Button variant="danger" onClick={onConfirmCancel}>
              Stop campaign
            </Button>
          </>
        }
      >
        {progress
          ? `${progress.sent} already sent can't be unsent; ${progress.pending + progress.sending} remaining will be cancelled.`
          : 'Remaining recipients will be cancelled.'}
      </Dialog>
    </StepLayout>
  );
}

/** Live per-recipient feed — the landing "Sending" slide's rows, driven by real
 *  recipient statuses. Polls the store while the run is active so rows flip
 *  queued → sending → sent in place. */
function RecipientFeed({ active }: { active: boolean }) {
  const recipients = useCampaignStore((s) => s.recipients);
  const refresh = useCampaignStore((s) => s.refresh);

  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => {
      if (!extensionContextAlive()) return clearInterval(id);
      void refresh().catch(() => {});
    }, 1500);
    return () => clearInterval(id);
  }, [active, refresh]);

  const rows = useMemo(() => orderForFeed(recipients).slice(0, 6), [recipients]);
  if (rows.length === 0) return null;

  return (
    <ul className="mt-5 flex flex-col gap-2">
      {rows.map((r) => (
        <li
          key={r.id}
          className={`flex items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--surface-sunken)] px-3 py-2 text-body ${
            r.status === 'pending' ? 'opacity-60' : ''
          }`}
        >
          <StatusIcon status={r.status} />
          <span className="min-w-0 flex-1 truncate font-mono text-mono-sm">{r.email || '—'}</span>
          <span className={`font-mono text-caption ${feedLabel(r.status).cls}`}>{feedLabel(r.status).text}</span>
        </li>
      ))}
    </ul>
  );
}

/** sending first, then most-recent sent, then failed/skipped, then queued. */
function orderForFeed(recipients: Recipient[]): Recipient[] {
  const rank: Record<RecipientStatus, number> = { sending: 0, sent: 1, failed: 2, skipped: 3, pending: 4 };
  return [...recipients].sort((a, b) => {
    const d = rank[a.status] - rank[b.status];
    if (d !== 0) return d;
    return (b.sentAt ?? 0) - (a.sentAt ?? 0);
  });
}

function StatusIcon({ status }: { status: RecipientStatus }) {
  switch (status) {
    case 'sent':
      return <CheckCircle2 size={16} className="shrink-0 text-brand-400" />;
    case 'sending':
      return <Loader2 size={16} className="shrink-0 animate-spin text-[var(--text-secondary)]" />;
    case 'failed':
      return <XCircle size={16} className="shrink-0 text-danger-fg" />;
    case 'skipped':
      return <MinusCircle size={16} className="shrink-0 text-warning-fg" />;
    case 'pending':
      // Slow clockwise spin so a queued row reads as "waiting its turn", not frozen.
      return (
        <Clock
          size={16}
          className="shrink-0 animate-spin text-[var(--text-muted)]"
          style={{ animationDuration: '4s' }}
        />
      );
  }
}

function feedLabel(status: RecipientStatus): { text: string; cls: string } {
  switch (status) {
    case 'sent':
      return { text: 'sent', cls: 'text-[var(--text-muted)]' };
    case 'sending':
      return { text: 'sending', cls: 'text-brand-400' };
    case 'failed':
      return { text: 'failed', cls: 'text-danger-fg' };
    case 'skipped':
      return { text: 'skipped', cls: 'text-warning-fg' };
    case 'pending':
      return { text: 'queued', cls: 'text-[var(--text-muted)]' };
  }
}
