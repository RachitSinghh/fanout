import type {
  AuthState,
  UserIdentity,
  Campaign,
  Recipient,
  SendLog,
  PauseReason,
  Template,
} from '@fanout/shared';

/** Input for creating a draft campaign from a compose window. */
export interface ComposeInput {
  subject: string;
  bodyHtml: string;
  bodyText: string;
  fromEmail: string;
  fromName: string;
}

/** Save payload for a template (TICKET-017); omit `id` to create a new one. */
export interface TemplateInput {
  id?: string;
  name: string;
  subject: string;
  bodyHtml: string;
  bodyText: string;
}

/**
 * Typed request/response protocol. The UI (popup/options/overlay) and content
 * script send `Request` messages to the service worker via chrome.runtime;
 * the worker replies with the matching `Response`. Progress is pushed the
 * other way as `BroadcastEvent`s.
 */

// ── Requests (caller → worker) ──────────────────────────────────────────────
export type Request =
  | { type: 'AUTH_CONNECT' }
  | { type: 'AUTH_GET_STATE' }
  | { type: 'AUTH_DISCONNECT' }
  | { type: 'GMAIL_SEND_TEST'; to: string }
  | { type: 'SEND_START'; campaignId: string }
  | { type: 'SEND_PAUSE'; campaignId: string }
  | { type: 'SEND_RESUME'; campaignId: string }
  | { type: 'SEND_CANCEL'; campaignId: string }
  | { type: 'SEND_RETRY_FAILED'; campaignId: string }
  | { type: 'SEND_GET_PROGRESS'; campaignId: string }
  // Data-access layer: the worker owns the extension-origin IndexedDB. The
  // content-script overlay (mail.google.com origin) must route through here.
  | { type: 'DATA_CAMPAIGN_CREATE'; compose: ComposeInput }
  | { type: 'DATA_CAMPAIGN_GET'; id: string }
  | { type: 'DATA_CAMPAIGN_UPDATE'; id: string; patch: Partial<Campaign> }
  | { type: 'DATA_CAMPAIGN_LIST' }
  | { type: 'DATA_CAMPAIGN_DELETE'; id: string }
  | { type: 'DATA_RECIPIENTS_REPLACE'; campaignId: string; recipients: Recipient[] }
  | { type: 'DATA_RECIPIENTS_LIST'; campaignId: string }
  | { type: 'DATA_SENDLOGS_LIST'; campaignId: string }
  // Template library (TICKET-017).
  | { type: 'DATA_TEMPLATE_SAVE'; template: TemplateInput }
  | { type: 'DATA_TEMPLATE_LIST' }
  | { type: 'DATA_TEMPLATE_DELETE'; id: string };

export type RequestType = Request['type'];

// ── Per-request response payloads ───────────────────────────────────────────
export interface ProgressSnapshot {
  campaignId: string;
  status: string;
  total: number;
  sent: number;
  failed: number;
  skipped: number;
  pending: number;
  sending: number;
  /** Estimated ms until the next send fires (jittered throttle). */
  nextSendInMs: number | null;
  /** Daily cap headroom for the sending account. */
  dailyCount: number;
  dailyCap: number;
  /** Why the campaign is paused, if it is (drives resume/reconnect UI). */
  pauseReason: PauseReason;
  /** Set when the campaign stopped for an account-level reason. */
  accountStopReason: string | null;
}

export interface ResponseMap {
  AUTH_CONNECT: { identity: UserIdentity };
  AUTH_GET_STATE: AuthState;
  AUTH_DISCONNECT: { ok: true };
  GMAIL_SEND_TEST: { messageId: string };
  SEND_START: { ok: true };
  SEND_PAUSE: { ok: true };
  SEND_RESUME: { ok: true };
  SEND_CANCEL: { ok: true };
  SEND_RETRY_FAILED: { requeued: number };
  SEND_GET_PROGRESS: ProgressSnapshot | null;
  DATA_CAMPAIGN_CREATE: Campaign;
  DATA_CAMPAIGN_GET: Campaign | null;
  DATA_CAMPAIGN_UPDATE: { ok: true };
  DATA_CAMPAIGN_LIST: Campaign[];
  DATA_CAMPAIGN_DELETE: { ok: true };
  DATA_RECIPIENTS_REPLACE: { ok: true };
  DATA_RECIPIENTS_LIST: Recipient[];
  DATA_SENDLOGS_LIST: SendLog[];
  DATA_TEMPLATE_SAVE: Template;
  DATA_TEMPLATE_LIST: Template[];
  DATA_TEMPLATE_DELETE: { ok: true };
}

/** Wire envelope so the caller can distinguish success from a thrown error. */
export type Reply<T> = { ok: true; data: T } | { ok: false; error: string };

// ── Broadcast events (worker → all listeners) ───────────────────────────────
export type BroadcastEvent =
  | { type: 'PROGRESS'; snapshot: ProgressSnapshot }
  | { type: 'AUTH_CHANGED'; state: AuthState };

/** Send a typed request to the worker and await its reply. */
export async function sendToWorker<T extends RequestType>(
  req: Extract<Request, { type: T }>,
): Promise<ResponseMap[T]> {
  const reply = (await chrome.runtime.sendMessage(req)) as Reply<ResponseMap[T]>;
  if (!reply) throw new Error('No response from service worker');
  if (!reply.ok) throw new Error(reply.error);
  return reply.data;
}

/** Subscribe to worker broadcasts; returns an unsubscribe fn. */
export function onBroadcast(handler: (e: BroadcastEvent) => void): () => void {
  const listener = (msg: unknown) => {
    if (msg && typeof msg === 'object' && 'type' in msg) {
      const t = (msg as { type: string }).type;
      if (t === 'PROGRESS' || t === 'AUTH_CHANGED') handler(msg as BroadcastEvent);
    }
  };
  chrome.runtime.onMessage.addListener(listener);
  return () => chrome.runtime.onMessage.removeListener(listener);
}

export function broadcast(event: BroadcastEvent): void {
  // Best-effort; ignore "no receivers" errors when no UI is open.
  chrome.runtime.sendMessage(event).catch(() => {});
}
