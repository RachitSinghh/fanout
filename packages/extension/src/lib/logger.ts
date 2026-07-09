import { isDev } from './config';

/**
 * PII-scrubbed logger. Recipient emails, names, and message content must never
 * leave the browser via logs/telemetry (SECURITY_AND_ACCESS §5.6). This scrubs
 * anything that looks like an email address before it is emitted, and callers
 * are expected to pass aggregate context (counts, campaign UUIDs, error codes)
 * rather than raw recipient data.
 */
const EMAIL_RE = /[^\s@<>"]+@[^\s@<>"]+\.[^\s@<>"]+/g;

function scrub(value: unknown): unknown {
  if (typeof value === 'string') return value.replace(EMAIL_RE, '[email]');
  if (Array.isArray(value)) return value.map(scrub);
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      // Drop fields known to carry PII outright.
      if (['email', 'fields', 'bodyHtml', 'bodyText', 'subject', 'name'].includes(k)) {
        out[k] = '[redacted]';
      } else {
        out[k] = scrub(v);
      }
    }
    return out;
  }
  return value;
}

function emit(level: 'debug' | 'info' | 'warn' | 'error', msg: string, ctx?: unknown) {
  const scrubbedMsg = scrub(msg) as string;
  const scrubbedCtx = ctx === undefined ? undefined : scrub(ctx);
  const prefix = `[fanout] ${scrubbedMsg}`;
  // In production, only warn/error reach the console.
  if (!isDev && (level === 'debug' || level === 'info')) return;
  if (scrubbedCtx === undefined) console[level](prefix);
  else console[level](prefix, scrubbedCtx);
  // TODO: forward warn/error to Sentry with the same scrubbing (FRONTEND_SPEC §11.2).
}

export const logger = {
  debug: (msg: string, ctx?: unknown) => emit('debug', msg, ctx),
  info: (msg: string, ctx?: unknown) => emit('info', msg, ctx),
  warn: (msg: string, ctx?: unknown) => emit('warn', msg, ctx),
  error: (msg: string, ctx?: unknown) => emit('error', msg, ctx),
};
