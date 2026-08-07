/**
 * Core domain types for a bulk-send "campaign" and its recipients.
 * These mirror the local IndexedDB schema (ARCHITECTURE §4.1) and are the
 * contract shared between the UI, the service worker, and the DB layer.
 */

export type CampaignStatus =
  | 'draft'
  | 'ready'
  | 'scheduled'
  | 'sending'
  | 'paused'
  | 'completed'
  | 'failed'
  | 'cancelled';

/** Why a campaign is currently paused (drives resume behavior + UI copy). */
export type PauseReason = 'user' | 'daily_cap' | 'account' | 'auth' | null;

export type RecipientStatus =
  | 'pending'
  | 'sending'
  | 'sent'
  | 'failed'
  | 'skipped';

/** How the inter-send delay is applied. */
export interface ThrottleConfig {
  /** Fixed delay in ms, or the lower bound when `mode === 'random'`. */
  minMs: number;
  /** Upper bound in ms when `mode === 'random'`; ignored for 'fixed'. */
  maxMs: number;
  mode: 'fixed' | 'random';
}

/** A single detected/mapped personalization token. */
export interface TokenMapping {
  /** Token name as used in the body, e.g. "FirstName". */
  token: string;
  /** Source column header it maps to, or null if unmapped. */
  column: string | null;
  /** True when the mapping was auto-detected (vs. set by the user). */
  auto: boolean;
}

export interface Campaign {
  id: string;
  name: string;
  subject: string;
  bodyHtml: string;
  bodyText: string;
  fromEmail: string;
  fromName: string;
  /** Distinct token names found in subject+body, e.g. ["FirstName","Company"]. */
  tokenSchema: string[];
  /** Column-header → token mapping resolved at map time. */
  columnMappings: TokenMapping[];
  /** The CSV/paste headers in original order (for the mapper + export). */
  headers: string[];
  status: CampaignStatus;
  /** Set when status is `paused`; explains why (for resume + messaging). */
  pauseReason: PauseReason;
  /** Human-readable account-level stop reason (Gmail 403/flagged), else null. */
  accountError: string | null;
  /** When status is `scheduled`, the epoch-ms time the send auto-starts (TICKET-016); else null. */
  scheduledAt: number | null;
  throttle: ThrottleConfig;
  /** Optional per-campaign daily cap; the account cap is a separate hard ceiling. */
  dailyCap: number | null;
  totalRecipients: number;
  sentCount: number;
  failedCount: number;
  skippedCount: number;
  createdAt: number;
  updatedAt: number;
  completedAt: number | null;
}

export interface Recipient {
  id: string;
  campaignId: string;
  email: string;
  /** All imported column data, keyed by original header. */
  fields: Record<string, string>;
  status: RecipientStatus;
  attempts: number;
  lastError: string | null;
  /** Reason a row was skipped pre-send (invalid email, duplicate, missing token). */
  skipReason: string | null;
  gmailMessageId: string | null;
  sentAt: number | null;
}

/**
 * A reusable subject+body template (TICKET-017). Stored locally like campaigns;
 * `{{Token}}` placeholders are preserved verbatim and re-resolved when the
 * template is applied to a campaign.
 */
export interface Template {
  id: string;
  name: string;
  subject: string;
  bodyHtml: string;
  bodyText: string;
  createdAt: number;
  updatedAt: number;
}

export type SendOutcome =
  | 'success'
  | 'transient_error'
  | 'permanent_error'
  | 'rate_limited'
  | 'account_error';

export interface SendLog {
  id: string;
  campaignId: string;
  recipientId: string;
  attemptNumber: number;
  outcome: SendOutcome;
  httpStatus: number | null;
  errorCode: string | null;
  timestamp: number;
}

/** Per-account per-day send counter (the local daily-cap guardrail). */
export interface SendCounter {
  /** Composite key `<accountEmail>:<YYYY-MM-DD>`. */
  id: string;
  accountEmail: string;
  date: string;
  count: number;
}
