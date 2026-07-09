import { useEffect, useMemo, useState } from 'react';
import { SendHorizontal, Pause, Play, ShieldCheck, AlertTriangle, XCircle, RotateCw } from 'lucide-react';
import { useCampaignStore } from '../../../store/campaignStore';
import { useSendStatusStore } from '../../../store/sendStatusStore';
import { useAuthStore } from '../../../store/authStore';
import { StepLayout } from '../StepLayout';
import { Button, Card, Callout } from '../../components/primitives';
import { Dialog } from '../../components/Dialog';
import { ProgressBar } from '../../components/ProgressBar';
import { sendableRecipients } from '../../../services/preview';

export function SendStep() {
  const campaign = useCampaignStore((s) => s.campaign);
  const recipients = useCampaignStore((s) => s.recipients);
  const goTo = useCampaignStore((s) => s.goTo);
  const { progress, attach, detach, start, pause, resume, cancel } = useSendStatusStore();

  useEffect(() => {
    if (campaign) void attach(campaign.id);
    return () => detach();
  }, [campaign, attach, detach]);

  const sendable = useMemo(() => sendableRecipients(recipients), [recipients]);
  const [confirmSend, setConfirmSend] = useState(false);
  const [confirmCancel, setConfirmCancel] = useState(false);

  if (!campaign) return null;

  const started = progress
    ? ['sending', 'paused', 'completed', 'cancelled', 'failed'].includes(progress.status)
    : campaign.status !== 'draft' && campaign.status !== 'ready';

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
        onBack={() => goTo('review')}
      />
    );
  }

  return (
    <Sending
      progress={progress}
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
  onBack: () => void;
}) {
  const delayText =
    throttle.mode === 'fixed'
      ? `${Math.round(throttle.minMs / 1000)}s between sends`
      : `${Math.round(throttle.minMs / 1000)}–${Math.round(throttle.maxMs / 1000)}s (randomized) between sends`;

  // Daily-cap pre-send warning (TICKET-010): does this run exceed the remaining
  // allowance for today?
  const remaining = progress ? Math.max(0, progress.dailyCap - progress.dailyCount) : null;
  const exceedsToday = remaining != null && count > remaining;

  return (
    <StepLayout
      footer={
        <>
          <Button variant="secondary" onClick={onBack}>
            Back
          </Button>
          <Button size="lg" leadingIcon={<SendHorizontal size={18} />} disabled={count === 0} onClick={onOpenConfirm}>
            Send {count} email{count === 1 ? '' : 's'}
          </Button>
        </>
      }
    >
      <h2 className="text-h2">Ready to send</h2>
      <Card className="mt-3">
        <dl className="flex flex-col gap-2 text-body">
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
        icon={<SendHorizontal className="text-brand-600" size={28} />}
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

function Sending({
  progress,
  onPause,
  onResume,
  onViewReport,
  confirmCancelOpen,
  onOpenCancel,
  onCloseCancel,
  onConfirmCancel,
}: {
  progress: ReturnType<typeof useSendStatusStore.getState>['progress'];
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
      <h2 className="text-h2">
        {status === 'completed' ? 'Done' : status === 'cancelled' ? 'Cancelled' : 'Sending'}
      </h2>

      <div className="mt-4">
        {progress ? <ProgressBar p={progress} /> : <p className="text-body text-[var(--text-muted)]">Starting…</p>}
      </div>

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
