import { getAccessToken, refreshAccessToken } from '../services/authService';
import { logger } from '../lib/logger';

const SEND_URL = 'https://gmail.googleapis.com/gmail/v1/users/me/messages/send';

export type SendErrorBucket =
  | 'transient' // 429 / 5xx — retry with backoff
  | 'permanent' // 400 invalidArgument — never retry
  | 'account' // 403 quota/flagged/disabled — STOP the campaign
  | 'auth'; // 401 — refresh once, else reconnect

export type SendResult =
  | { ok: true; messageId: string }
  | {
      ok: false;
      bucket: SendErrorBucket;
      httpStatus: number | null;
      errorCode: string | null;
      message: string;
    };

interface GmailError {
  error?: {
    code?: number;
    message?: string;
    errors?: Array<{ reason?: string; message?: string }>;
    status?: string;
  };
}

/** Classify a Gmail API error response into one of the four buckets. */
function classify(httpStatus: number, reason: string | null): SendErrorBucket {
  if (httpStatus === 401) return 'auth';
  if (httpStatus === 429) return 'transient';
  if (httpStatus >= 500) return 'transient';
  if (httpStatus === 403) return 'account';
  if (httpStatus === 400) return 'permanent';
  // Unknown 4xx: treat as permanent so we never hammer Google.
  return 'permanent';
}

async function postSend(raw: string, token: string): Promise<Response> {
  return fetch(SEND_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ raw }),
  });
}

/**
 * A `fetch` rejection (offline, DNS, connection reset) has no HTTP status, so it
 * can't go through `classify`. The request never reached Gmail, so nothing was
 * sent — treat it as transient and let the engine requeue with backoff. Without
 * this the exception escapes to the tick loop and strands the claimed recipient
 * in `sending` forever (never retried, never failed).
 */
function networkError(e: unknown): SendResult {
  return {
    ok: false,
    bucket: 'transient',
    httpStatus: null,
    errorCode: 'network',
    message: e instanceof Error ? e.message : 'Network request failed',
  };
}

/**
 * Send one already-built raw MIME message. Handles a single silent token
 * refresh on 401 (FRONTEND_SPEC §8.1) and returns a classified result;
 * retry/backoff scheduling is the send engine's job (TICKET-012).
 */
export async function sendRawEmail(raw: string): Promise<SendResult> {
  let token: string;
  try {
    token = await getAccessToken(false);
  } catch (e) {
    return {
      ok: false,
      bucket: 'auth',
      httpStatus: 401,
      errorCode: 'noToken',
      message: e instanceof Error ? e.message : 'No access token',
    };
  }

  let res: Response;
  try {
    res = await postSend(raw, token);
  } catch (e) {
    return networkError(e);
  }

  // On 401, refresh the token once and retry before surfacing an auth error.
  if (res.status === 401) {
    try {
      token = await refreshAccessToken(token);
    } catch {
      return {
        ok: false,
        bucket: 'auth',
        httpStatus: 401,
        errorCode: 'refreshFailed',
        message: 'Could not refresh Google access',
      };
    }
    try {
      res = await postSend(raw, token);
    } catch (e) {
      return networkError(e);
    }
  }

  if (res.ok) {
    try {
      const body = (await res.json()) as { id?: string };
      return { ok: true, messageId: body.id ?? '' };
    } catch {
      // 2xx with an unparseable body — the send succeeded; we just lack the id.
      return { ok: true, messageId: '' };
    }
  }

  let reason: string | null = null;
  let message = `Gmail API error ${res.status}`;
  try {
    const body = (await res.json()) as GmailError;
    reason = body.error?.errors?.[0]?.reason ?? body.error?.status ?? null;
    message = body.error?.message ?? message;
  } catch {
    // Non-JSON error body; keep the generic message.
  }

  const bucket = classify(res.status, reason);
  logger.warn('gmail send failed', { httpStatus: res.status, reason, bucket });
  return { ok: false, bucket, httpStatus: res.status, errorCode: reason, message };
}
