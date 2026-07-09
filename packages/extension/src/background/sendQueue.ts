import type { Campaign, Recipient, PauseReason, SendOutcome } from '@fanout/shared';
import { db } from '../db/schema';
import { appendSendLog, recomputeCounts, countByStatus, uuid } from '../db/campaigns';
import { buildRawMessage } from '../services/mimeBuilder';
import { renderForRecipient } from '../services/preview';
import { tokenValuesFor } from '../services/recipients';
import { sendRawEmail } from './gmailClient';
import * as auth from '../services/authService';
import { nextDelayMs } from './throttle';
import { backoffMs, canRetry } from './retry';
import {
  getTodayCount,
  incrementToday,
  effectiveDailyCap,
  msUntilNextLocalMidnight,
} from './rateLimiter';
import { broadcast, type Request, type ProgressSnapshot } from '../messaging/channel';
import { logger } from '../lib/logger';

/**
 * Alarms-driven, resumable send engine (ARCHITECTURE §7.1). Each tick reads the
 * next `pending` recipient from IndexedDB, sends it, records the outcome, and
 * schedules the next tick. All state lives in the DB, so the worker can die and
 * be revived at any point and resume exactly where it left off with no
 * double-sends (idempotent claim inside a transaction, §7.5).
 */

const ALARM_TICK = 'fanout-tick';
const ALARM_RESUME = 'fanout-daily-resume';
/** Chrome clamps alarms to ~30s minimum; use a timer for shorter waits. */
const ALARM_MIN_MS = 31_000;

// In-memory guard so two overlapping ticks never send concurrently. (Belt; the
// DB transaction is the real correctness guarantee.)
let ticking = false;
let pendingTimer: ReturnType<typeof setTimeout> | null = null;

// ── Public API (called by the worker's message router) ──────────────────────

export async function handleSendRequest(req: Request): Promise<unknown> {
  switch (req.type) {
    case 'SEND_START':
      await start(req.campaignId);
      return { ok: true };
    case 'SEND_PAUSE':
      await pause(req.campaignId, 'user');
      return { ok: true };
    case 'SEND_RESUME':
      await resume(req.campaignId);
      return { ok: true };
    case 'SEND_CANCEL':
      await cancel(req.campaignId);
      return { ok: true };
    case 'SEND_RETRY_FAILED':
      return { requeued: await retryFailed(req.campaignId) };
    case 'SEND_GET_PROGRESS':
      return getProgress(req.campaignId);
    default:
      throw new Error(`sendQueue: unhandled ${req.type}`);
  }
}

/** On worker startup, resume any campaign left mid-send (§7.1). */
export async function resumeSending(): Promise<void> {
  const active = await db.campaigns.where('status').equals('sending').first();
  if (active) {
    logger.info('resuming in-flight campaign', { campaignId: active.id });
    scheduleTick(0);
    return;
  }
  // A campaign paused for the daily cap may be resumable if the day rolled over.
  const capped = await db.campaigns.filter((c) => c.status === 'paused' && c.pauseReason === 'daily_cap').first();
  if (capped) await maybeResumeCapped(capped);
}

// ── State transitions ───────────────────────────────────────────────────────

async function start(campaignId: string): Promise<void> {
  await db.campaigns.update(campaignId, {
    status: 'sending',
    pauseReason: null,
    accountError: null,
    updatedAt: Date.now(),
  });
  scheduleTick(0);
}

async function pause(campaignId: string, reason: PauseReason, accountError: string | null = null): Promise<void> {
  clearSchedules();
  await db.campaigns.update(campaignId, {
    status: 'paused',
    pauseReason: reason,
    accountError,
    updatedAt: Date.now(),
  });
  await broadcastProgress(campaignId);
}

async function resume(campaignId: string): Promise<void> {
  await db.campaigns.update(campaignId, {
    status: 'sending',
    pauseReason: null,
    accountError: null,
    updatedAt: Date.now(),
  });
  scheduleTick(0);
}

async function cancel(campaignId: string): Promise<void> {
  clearSchedules();
  // Record which recipients were not sent (marked skipped/cancelled).
  await db.transaction('rw', db.recipients, db.campaigns, async () => {
    const pendingRows = await db.recipients
      .where('campaignId')
      .equals(campaignId)
      .filter((r) => r.status === 'pending' || r.status === 'sending')
      .toArray();
    for (const r of pendingRows) {
      await db.recipients.update(r.id, { status: 'skipped', skipReason: 'Cancelled' });
    }
    await db.campaigns.update(campaignId, {
      status: 'cancelled',
      pauseReason: null,
      updatedAt: Date.now(),
    });
  });
  await recomputeCounts(campaignId);
  await broadcastProgress(campaignId);
}

/** Requeue only failed recipients (TICKET-012); never touches successes. */
async function retryFailed(campaignId: string): Promise<number> {
  let requeued = 0;
  await db.transaction('rw', db.recipients, async () => {
    const failed = await db.recipients
      .where('campaignId')
      .equals(campaignId)
      .filter((r) => r.status === 'failed')
      .toArray();
    for (const r of failed) {
      await db.recipients.update(r.id, {
        status: 'pending',
        attempts: 0,
        lastError: null,
        skipReason: null,
      });
      requeued++;
    }
  });
  if (requeued > 0) {
    await db.campaigns.update(campaignId, { status: 'sending', pauseReason: null, updatedAt: Date.now() });
    scheduleTick(0);
  }
  return requeued;
}

// ── The tick loop ───────────────────────────────────────────────────────────

async function tick(): Promise<void> {
  if (ticking) return;
  ticking = true;
  if (pendingTimer) {
    clearTimeout(pendingTimer);
    pendingTimer = null;
  }
  try {
    const campaign = await db.campaigns.where('status').equals('sending').first();
    if (!campaign) {
      clearSchedules();
      return;
    }

    const identity = await auth.getIdentity();
    if (!identity) {
      await pause(campaign.id, 'auth');
      return;
    }

    // Daily-cap guardrail — enforced BEFORE any network call (TICKET-010).
    const cap = effectiveDailyCap(identity.accountType, campaign.dailyCap);
    const todayCount = await getTodayCount(campaign.fromEmail);
    if (todayCount >= cap) {
      await pause(campaign.id, 'daily_cap');
      chrome.alarms.create(ALARM_RESUME, { when: Date.now() + msUntilNextLocalMidnight() });
      logger.info('daily cap reached — paused until tomorrow', { campaignId: campaign.id, cap });
      return;
    }

    const next = await db.recipients
      .where('[campaignId+status]')
      .equals([campaign.id, 'pending'])
      .first();

    if (!next) {
      await complete(campaign);
      return;
    }

    await sendOne(campaign, next, identity.name);
  } catch (e) {
    logger.error('tick failed', { message: e instanceof Error ? e.message : String(e) });
    // Reschedule a slow retry so a transient worker error doesn't strand a run.
    scheduleTick(ALARM_MIN_MS);
  } finally {
    ticking = false;
  }
}

async function sendOne(campaign: Campaign, recipient: Recipient, fromName: string): Promise<void> {
  // Idempotent claim: only proceed if still pending, inside a transaction (§7.5).
  const claimed = await db.transaction('rw', db.recipients, async () => {
    const fresh = await db.recipients.get(recipient.id);
    if (!fresh || fresh.status !== 'pending') return null;
    const attempts = fresh.attempts + 1;
    await db.recipients.update(fresh.id, { status: 'sending', attempts });
    return { ...fresh, status: 'sending' as const, attempts };
  });
  if (!claimed) {
    // Another tick already took it; loop immediately.
    scheduleTick(0);
    return;
  }

  const rendered = renderForRecipient(campaign, claimed);
  const values = tokenValuesFor(claimed.fields, campaign.columnMappings);
  const toName = [values.FirstName, values.LastName].filter(Boolean).join(' ').trim();
  const raw = buildRawMessage({
    fromName: campaign.fromName || fromName,
    fromEmail: campaign.fromEmail,
    toName: toName || undefined,
    toEmail: claimed.email,
    subject: rendered.subject,
    bodyText: rendered.bodyText,
    bodyHtml: rendered.bodyHtml,
  });

  const result = await sendRawEmail(raw);
  const now = Date.now();

  if (result.ok) {
    await db.recipients.update(claimed.id, {
      status: 'sent',
      gmailMessageId: result.messageId,
      sentAt: now,
      lastError: null,
    });
    await incrementToday(campaign.fromEmail);
    await log(campaign.id, claimed.id, claimed.attempts, 'success', 200, null);
    await recomputeCounts(campaign.id);
    await broadcastProgress(campaign.id);
    scheduleTick(nextDelayMs(campaign.throttle));
    return;
  }

  // Failure — classified into buckets (SECURITY_AND_ACCESS §4.2).
  switch (result.bucket) {
    case 'transient': {
      await log(campaign.id, claimed.id, claimed.attempts, 'transient_error', result.httpStatus, result.errorCode);
      if (canRetry(claimed.attempts)) {
        // Return to the queue; retry after exponential backoff.
        await db.recipients.update(claimed.id, { status: 'pending', lastError: result.message });
        await broadcastProgress(campaign.id);
        scheduleTick(backoffMs(claimed.attempts));
      } else {
        await db.recipients.update(claimed.id, { status: 'failed', lastError: result.message });
        await recomputeCounts(campaign.id);
        await broadcastProgress(campaign.id);
        scheduleTick(nextDelayMs(campaign.throttle));
      }
      return;
    }
    case 'permanent': {
      await db.recipients.update(claimed.id, {
        status: 'failed',
        lastError: result.message,
        skipReason: null,
      });
      await log(campaign.id, claimed.id, claimed.attempts, 'permanent_error', result.httpStatus, result.errorCode);
      await recomputeCounts(campaign.id);
      await broadcastProgress(campaign.id);
      scheduleTick(nextDelayMs(campaign.throttle));
      return;
    }
    case 'account': {
      // STOP the whole campaign — protecting the user's Gmail is paramount.
      await db.recipients.update(claimed.id, { status: 'pending', lastError: result.message });
      await log(campaign.id, claimed.id, claimed.attempts, 'account_error', result.httpStatus, result.errorCode);
      await pause(campaign.id, 'account', result.message);
      logger.warn('account-level stop', { campaignId: campaign.id, code: result.errorCode });
      return;
    }
    case 'auth': {
      await db.recipients.update(claimed.id, { status: 'pending', lastError: result.message });
      await log(campaign.id, claimed.id, claimed.attempts, 'permanent_error', result.httpStatus, result.errorCode);
      await pause(campaign.id, 'auth', result.message);
      return;
    }
  }
}

async function complete(campaign: Campaign): Promise<void> {
  clearSchedules();
  await db.campaigns.update(campaign.id, {
    status: 'completed',
    pauseReason: null,
    completedAt: Date.now(),
    updatedAt: Date.now(),
  });
  await recomputeCounts(campaign.id);
  await broadcastProgress(campaign.id);
  logger.info('campaign complete', { campaignId: campaign.id });
}

async function maybeResumeCapped(campaign: Campaign): Promise<void> {
  const identity = await auth.getIdentity();
  if (!identity) return;
  const cap = effectiveDailyCap(identity.accountType, campaign.dailyCap);
  const todayCount = await getTodayCount(campaign.fromEmail);
  if (todayCount < cap) {
    await resume(campaign.id);
  } else {
    chrome.alarms.create(ALARM_RESUME, { when: Date.now() + msUntilNextLocalMidnight() });
  }
}

// ── Scheduling ──────────────────────────────────────────────────────────────

function scheduleTick(delayMs: number): void {
  if (pendingTimer) {
    clearTimeout(pendingTimer);
    pendingTimer = null;
  }
  // Fallback alarm survives worker death (min ~30s). Honors the real delay via
  // a timer when the worker is alive and the delay is short.
  const alarmWhen = Date.now() + Math.max(delayMs, ALARM_MIN_MS);
  chrome.alarms.create(ALARM_TICK, { when: alarmWhen });
  if (delayMs < ALARM_MIN_MS) {
    pendingTimer = setTimeout(() => {
      pendingTimer = null;
      void tick();
    }, delayMs);
  }
}

function clearSchedules(): void {
  if (pendingTimer) {
    clearTimeout(pendingTimer);
    pendingTimer = null;
  }
  chrome.alarms.clear(ALARM_TICK);
}

// ── Progress + logging ──────────────────────────────────────────────────────

async function buildSnapshot(campaignId: string): Promise<ProgressSnapshot | null> {
  const campaign = await db.campaigns.get(campaignId);
  if (!campaign) return null;
  const counts = await countByStatus(campaignId);
  const total = counts.pending + counts.sending + counts.sent + counts.failed + counts.skipped;
  const identity = await auth.getIdentity();
  const cap = effectiveDailyCap(identity?.accountType ?? 'unknown', campaign.dailyCap);
  const dailyCount = await getTodayCount(campaign.fromEmail);
  const approxDelay =
    campaign.status === 'sending'
      ? Math.round((campaign.throttle.minMs + campaign.throttle.maxMs) / 2)
      : null;
  return {
    campaignId,
    status: campaign.status,
    total,
    sent: counts.sent,
    failed: counts.failed,
    skipped: counts.skipped,
    pending: counts.pending,
    sending: counts.sending,
    nextSendInMs: approxDelay,
    dailyCount,
    dailyCap: cap,
    pauseReason: campaign.pauseReason,
    accountStopReason: campaign.accountError,
  };
}

async function getProgress(campaignId: string): Promise<ProgressSnapshot | null> {
  return buildSnapshot(campaignId);
}

async function broadcastProgress(campaignId: string): Promise<void> {
  const snapshot = await buildSnapshot(campaignId);
  if (snapshot) broadcast({ type: 'PROGRESS', snapshot });
}

async function log(
  campaignId: string,
  recipientId: string,
  attemptNumber: number,
  outcome: SendOutcome,
  httpStatus: number | null,
  errorCode: string | null,
): Promise<void> {
  await appendSendLog({
    id: uuid(),
    campaignId,
    recipientId,
    attemptNumber,
    outcome,
    httpStatus,
    errorCode,
    timestamp: Date.now(),
  });
}

// ── Alarm wiring ────────────────────────────────────────────────────────────

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === ALARM_TICK) {
    void tick();
  } else if (alarm.name === ALARM_RESUME) {
    void (async () => {
      const capped = await db.campaigns
        .filter((c) => c.status === 'paused' && c.pauseReason === 'daily_cap')
        .first();
      if (capped) await maybeResumeCapped(capped);
    })();
  }
});
