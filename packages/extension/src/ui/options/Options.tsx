import { useEffect, useState } from 'react';
import { ShieldCheck, Timer, Gauge } from 'lucide-react';
import type { ThrottleConfig } from '@fanout/shared';
import { DEFAULT_THROTTLE, MIN_SEND_DELAY_MS } from '@fanout/shared';
import { useAuthStore } from '../../store/authStore';
import { getSetting, setSetting, SETTING_KEYS } from '../../db/settings';
import { Button, Card, Callout, Wordmark, Badge } from '../components/primitives';

export function Options() {
  const { status, identity, hydrate, connect, disconnect } = useAuthStore();
  useEffect(() => {
    void hydrate();
  }, [hydrate]);

  return (
    <div className="mx-auto max-w-[960px] px-6 py-10">
      <header className="mb-8 flex items-center justify-between">
        <Wordmark className="text-h1" />
        <span className="text-caption text-[var(--text-muted)]">Settings</span>
      </header>

      <div className="flex flex-col gap-6">
        <section>
          <h1 className="mb-3 text-h1">Account</h1>
          <Card>
            {status === 'connected' && identity ? (
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-overline uppercase text-[var(--text-muted)]">
                    Signed in
                  </p>
                  <p className="font-mono text-mono-sm">{identity.email}</p>
                  <p className="mt-1 text-caption text-[var(--text-muted)]">
                    Account type: {identity.accountType}
                  </p>
                </div>
                <Button variant="secondary" size="sm" onClick={disconnect}>
                  Disconnect
                </Button>
              </div>
            ) : (
              <div className="flex items-center justify-between">
                <p className="text-body text-[var(--text-secondary)]">
                  Connect your Google account to start sending.
                </p>
                <Button size="md" onClick={connect} loading={status === 'connecting'}>
                  Connect Gmail
                </Button>
              </div>
            )}
          </Card>
        </section>

        <section>
          <h1 className="mb-3 text-h1">Sending defaults</h1>
          <DefaultsCard />
        </section>

        <section>
          <h1 className="mb-3 text-h1">Privacy</h1>
          <Callout tone="info" icon={<ShieldCheck size={16} />}>
            Your recipient lists and email content live only in this browser and
            are never uploaded. Fanout only requests permission to{' '}
            <strong>send</strong> mail — not to read your inbox.
          </Callout>
        </section>
      </div>
    </div>
  );
}

function DefaultsCard() {
  const [throttle, setThrottle] = useState<ThrottleConfig>(DEFAULT_THROTTLE);
  const [dailyCap, setDailyCap] = useState<number | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    void (async () => {
      setThrottle(await getSetting(SETTING_KEYS.defaultThrottle, DEFAULT_THROTTLE));
      setDailyCap(await getSetting<number | null>(SETTING_KEYS.defaultDailyCap, null));
    })();
  }, []);

  async function save() {
    await setSetting(SETTING_KEYS.defaultThrottle, throttle);
    await setSetting(SETTING_KEYS.defaultDailyCap, dailyCap);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  const minSeconds = Math.round(throttle.minMs / 1000);
  const maxSeconds = Math.round(throttle.maxMs / 1000);

  return (
    <Card roomy>
      <div className="flex items-center gap-2">
        <Timer size={18} className="text-brand-600" />
        <h2 className="text-h2">Delay between sends</h2>
      </div>
      <p className="mt-1 text-body text-[var(--text-secondary)]">
        A randomized pause between each individual send protects your account
        from Gmail's spam heuristics. We recommend keeping this on.
      </p>
      <div className="mt-4 flex items-center gap-3">
        <label className="text-label">
          Min (s)
          <input
            type="number"
            min={MIN_SEND_DELAY_MS / 1000}
            value={minSeconds}
            onChange={(e) =>
              setThrottle((t) => ({ ...t, minMs: Number(e.target.value) * 1000 }))
            }
            className="ml-2 h-9 w-20 rounded-md border border-neutral-300 bg-neutral-100 px-3 font-mono text-mono-sm"
          />
        </label>
        <label className="text-label">
          Max (s)
          <input
            type="number"
            min={minSeconds}
            value={maxSeconds}
            onChange={(e) =>
              setThrottle((t) => ({ ...t, maxMs: Number(e.target.value) * 1000, mode: 'random' }))
            }
            className="ml-2 h-9 w-20 rounded-md border border-neutral-300 bg-neutral-100 px-3 font-mono text-mono-sm"
          />
        </label>
      </div>

      <div className="mt-6 flex items-center gap-2">
        <Gauge size={18} className="text-brand-600" />
        <h2 className="text-h2">Default daily cap</h2>
      </div>
      <p className="mt-1 text-body text-[var(--text-secondary)]">
        Leave blank to use the safe limit for your account type (500/day
        consumer, 2000/day Workspace).
      </p>
      <input
        type="number"
        placeholder="Auto"
        value={dailyCap ?? ''}
        onChange={(e) => setDailyCap(e.target.value ? Number(e.target.value) : null)}
        className="mt-3 h-9 w-32 rounded-md border border-neutral-300 bg-neutral-100 px-3 font-mono text-mono-sm"
      />

      <div className="mt-6 flex items-center gap-3">
        <Button onClick={save}>Save defaults</Button>
        {saved && <Badge tone="success">Saved</Badge>}
      </div>
    </Card>
  );
}
