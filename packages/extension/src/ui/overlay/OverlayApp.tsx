import { useEffect, useRef } from 'react';
import { LazyMotion, domAnimation, m, AnimatePresence } from 'framer-motion';
import { LogIn, ShieldCheck } from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import { useCampaignStore } from '../../store/campaignStore';
import { useSendStatusStore } from '../../store/sendStatusStore';
import { useEntitlementStore } from '../../store/entitlementStore';
import { Button, Callout } from '../components/primitives';
import { CampaignPanel } from './CampaignPanel';
import type { ComposeSnapshot } from '../../content/gmailDom';
import { duration, spring } from '../motion/tokens';

export function OverlayApp({
  compose,
  onClose,
}: {
  compose: ComposeSnapshot;
  onClose: () => void;
}) {
  const auth = useAuthStore();
  const campaign = useCampaignStore((s) => s.campaign);
  const start = useCampaignStore((s) => s.start);
  const resumeActive = useCampaignStore((s) => s.resumeActive);
  const reset = useCampaignStore((s) => s.reset);
  const didInit = useRef(false);

  useEffect(() => {
    void auth.hydrate();
    void useEntitlementStore.getState().load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Once connected: resume an in-flight campaign if one exists, otherwise
  // create a fresh draft from the compose contents. Runs once.
  useEffect(() => {
    if (auth.status !== 'connected' || !auth.identity || campaign || didInit.current) return;
    didInit.current = true;
    void (async () => {
      const resumed = await resumeActive();
      if (!resumed && auth.identity) await start(compose, auth.identity);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auth.status, auth.identity, campaign]);

  // Sending must never be interrupted by an accidental backdrop click. Use the
  // live progress status (the store campaign can be stale during a send).
  const liveStatus = useSendStatusStore((s) => s.progress?.status);
  const storeStatus = useCampaignStore((s) => s.campaign?.status);
  const safeToClose = (liveStatus ?? storeStatus) !== 'sending';

  function handleClose() {
    reset();
    onClose();
  }

  return (
    <LazyMotion features={domAnimation}>
      <AnimatePresence>
        <m.div
          key="backdrop"
          className="fixed inset-0 flex items-center justify-center"
          style={{ background: 'rgba(0,0,0,0.62)' }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: duration.base }}
          onMouseDown={(e) => {
            if (e.target === e.currentTarget && safeToClose) handleClose();
          }}
        >
          <m.div
            key="panel"
            role="dialog"
            aria-modal="true"
            aria-label="Fanout campaign"
            className="flex max-h-[90vh] w-[720px] max-w-[95vw] flex-col rounded-xl border border-[var(--border)] bg-[var(--surface-sunken)] p-1.5"
            style={{ boxShadow: '0 24px 64px rgba(0,0,0,0.55)' }}
            initial={{ opacity: 0, scale: 0.96, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.98, y: 4 }}
            transition={spring.default}
          >
            {/* Inner window body — the landing hero card's card-in-card frame. */}
            <div className="flex min-h-0 w-full flex-1 flex-col overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--surface)]">
              {auth.status === 'connected' ? (
                <CampaignPanel onClose={handleClose} />
              ) : (
                <ConnectGate
                  connecting={auth.status === 'connecting'}
                  error={auth.error}
                  onConnect={auth.connect}
                  onClose={handleClose}
                />
              )}
            </div>
          </m.div>
        </m.div>
      </AnimatePresence>
    </LazyMotion>
  );
}

function ConnectGate({
  connecting,
  error,
  onConnect,
  onClose,
}: {
  connecting: boolean;
  error: string | null;
  onConnect: () => void;
  onClose: () => void;
}) {
  return (
    <div className="p-6">
      <h1 className="text-h1">Connect Gmail to continue</h1>
      <p className="mt-2 text-body text-[var(--text-secondary)]">
        Fanout sends each recipient their own individual email from your Gmail.
        Connect your account to start a campaign.
      </p>
      <Callout tone="info" icon={<ShieldCheck size={16} />} className="mt-4">
        We only request permission to <strong>send</strong> mail — never to read
        your inbox. Your recipients never leave this browser.
      </Callout>
      <div className="mt-5 flex items-center gap-3">
        <Button leadingIcon={<LogIn size={16} />} loading={connecting} onClick={onConnect}>
          Connect Gmail
        </Button>
        <Button variant="ghost" onClick={onClose}>
          Cancel
        </Button>
      </div>
      {error && <p className="mt-2 text-caption text-danger-fg">{error}</p>}
    </div>
  );
}
