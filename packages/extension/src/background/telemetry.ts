import type { Campaign } from '@fanout/shared';
import { db } from '../db/schema';
import { config } from '../lib/config';
import { logger } from '../lib/logger';
import { getSetting, SETTING_KEYS } from '../db/settings';
import * as auth from '../services/authService';

/**
 * Aggregate campaign telemetry (TICKET-034). **Counts and scrubbed error codes
 * only** — never a recipient address, name, subject, or body (SECURITY §5.6).
 * `campaignRef` is the opaque campaign UUID: not reversible to any recipient.
 *
 * No-ops until `VITE_BACKEND_URL` is configured, so it ships harmlessly in Phase 1
 * and lights up in Phase 2 (TICKET-039) with no extension re-release. Also honors
 * a user "share diagnostics" toggle, and never lets a failure disrupt sending.
 */
export interface CampaignTelemetry {
  campaignRef: string;
  attempted: number;
  sent: number;
  failed: number;
  skipped: number;
  /** Distinct Gmail error reasons seen (e.g. "rateLimitExceeded") — codes, not messages. */
  errorCodes: string[];
  extVersion: string;
}

/** Build the PII-free payload for a finished campaign. Exported for testing. */
export function buildTelemetry(campaign: Campaign, errorCodes: string[], extVersion: string): CampaignTelemetry {
  return {
    campaignRef: campaign.id,
    attempted: campaign.totalRecipients,
    sent: campaign.sentCount,
    failed: campaign.failedCount,
    skipped: campaign.skippedCount,
    errorCodes,
    extVersion,
  };
}

export async function emitCampaignTelemetry(campaign: Campaign): Promise<void> {
  if (!config.backendUrl) return; // no backend configured — do nothing.
  const share = await getSetting<boolean>(SETTING_KEYS.shareDiagnostics, true);
  if (!share) return;

  // Attribute to the sending Google account (identity only — the user's OWN sub
  // and email, never a recipient). Skip if not connected.
  const identity = await auth.getIdentity();
  if (!identity) return;

  // Distinct error reason codes from the append-only send log (never messages).
  const logs = await db.sendLogs.where('campaignId').equals(campaign.id).toArray();
  const errorCodes = [...new Set(logs.map((l) => l.errorCode).filter((c): c is string => !!c))];
  const version = chrome.runtime.getManifest().version;
  const payload = buildTelemetry(campaign, errorCodes, version);

  try {
    // ponytail: advisory/unverified report (SECURITY §3.4) — never a money gate.
    // A future hardening step can attach a verified Google ID token.
    await fetch(`${config.backendUrl}/api/telemetry`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        account: { sub: identity.sub, email: identity.email },
        campaign: payload,
      }),
    });
  } catch (e) {
    // Telemetry must NEVER break a send — swallow and log locally (scrubbed).
    logger.warn('telemetry post failed', { message: e instanceof Error ? e.message : String(e) });
  }
}
