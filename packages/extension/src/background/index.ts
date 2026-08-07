import { logger } from '../lib/logger';
import type { Reply, Request } from '../messaging/channel';
import * as auth from '../services/authService';
import { sendRawEmail } from './gmailClient';
import { buildRawMessage } from '../services/mimeBuilder';
import * as data from '../db/campaigns';
import * as templates from '../db/templates';
import { getEntitlement } from '../services/entitlementService';
// Static import: the send engine registers a top-level chrome.alarms listener as
// a side effect, which MV3 requires to run synchronously on worker load (an async
// import()s listener can miss the very alarm that woke the worker). It also keeps
// the SW off Vite's __vitePreload helper, which references window/document.
import { resumeSending, handleSendRequest } from './sendQueue';

logger.info('service worker started');

chrome.runtime.onInstalled.addListener((details) => {
  logger.info('installed', { reason: details.reason });
});

// On worker startup, resume any campaign left in `sending` (wired in TICKET-009).
chrome.runtime.onStartup.addListener(() => {
  logger.info('browser startup — checking for resumable campaigns');
  void resumeInFlight();
});

async function resumeInFlight(): Promise<void> {
  await resumeSending();
}

// Also attempt resume when the worker itself wakes (not just browser startup).
void resumeInFlight();

/** Dispatch a typed request to its handler, producing the matching response. */
async function handle(req: Request): Promise<unknown> {
  switch (req.type) {
    case 'AUTH_CONNECT':
      return { identity: await auth.connect() };
    case 'AUTH_GET_STATE':
      return auth.getState();
    case 'AUTH_DISCONNECT':
      await auth.disconnect();
      return { ok: true };
    case 'GMAIL_SEND_TEST': {
      const identity = await auth.getIdentity();
      if (!identity) throw new Error('Not connected');
      const raw = buildRawMessage({
        fromName: identity.name,
        fromEmail: identity.email,
        toEmail: req.to,
        subject: 'Fanout test email',
        bodyText: 'This is a test email sent from Fanout. If you received it, sending works. 🎉',
        bodyHtml:
          '<p>This is a test email sent from <strong>Fanout</strong>.</p><p>If you received it, sending works. 🎉</p>',
      });
      const result = await sendRawEmail(raw);
      if (!result.ok) throw new Error(result.message);
      return { messageId: result.messageId };
    }
    case 'SEND_START':
    case 'SEND_PAUSE':
    case 'SEND_RESUME':
    case 'SEND_CANCEL':
    case 'SEND_RETRY_FAILED':
    case 'SEND_GET_PROGRESS':
    case 'SEND_SCHEDULE':
    case 'SEND_UNSCHEDULE': {
      return handleSendRequest(req);
    }
    case 'DATA_CAMPAIGN_CREATE':
      return data.createDraftCampaign(req.compose);
    case 'DATA_CAMPAIGN_GET':
      return (await data.getCampaign(req.id)) ?? null;
    case 'DATA_CAMPAIGN_UPDATE':
      await data.updateCampaign(req.id, req.patch);
      return { ok: true };
    case 'DATA_CAMPAIGN_LIST':
      return data.listCampaigns();
    case 'DATA_CAMPAIGN_DELETE':
      await data.deleteCampaign(req.id);
      return { ok: true };
    case 'DATA_RECIPIENTS_REPLACE':
      await data.replaceRecipients(req.campaignId, req.recipients);
      return { ok: true };
    case 'DATA_RECIPIENTS_LIST':
      return data.listRecipients(req.campaignId);
    case 'DATA_SENDLOGS_LIST':
      return data.listSendLogs(req.campaignId);
    case 'DATA_TEMPLATE_SAVE':
      return templates.saveTemplate(req.template);
    case 'DATA_TEMPLATE_LIST':
      return templates.listTemplates();
    case 'DATA_TEMPLATE_DELETE':
      await templates.deleteTemplate(req.id);
      return { ok: true };
    case 'DATA_GET_ENTITLEMENT':
      return getEntitlement();
    default: {
      const _exhaustive: never = req;
      throw new Error(`Unknown request: ${JSON.stringify(_exhaustive)}`);
    }
  }
}

chrome.runtime.onMessage.addListener((msg: unknown, _sender, sendResponse) => {
  // Ignore our own broadcast events echoed back.
  if (msg && typeof msg === 'object' && 'type' in msg) {
    const t = (msg as { type: string }).type;
    if (t === 'PROGRESS' || t === 'AUTH_CHANGED') return false;
  }
  handle(msg as Request)
    .then((data) => sendResponse({ ok: true, data } satisfies Reply<unknown>))
    .catch((e: unknown) =>
      sendResponse({
        ok: false,
        error: e instanceof Error ? e.message : String(e),
      } satisfies Reply<never>),
    );
  return true; // keep the message channel open for the async response
});
