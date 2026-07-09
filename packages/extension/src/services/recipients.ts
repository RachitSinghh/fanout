import type { Recipient, TokenMapping } from '@fanout/shared';
import { AUTO_MAP_ALIASES, isValidEmail, normalizeEmail } from '@fanout/shared';
import { uuid } from '../db/campaigns';

/** Fuzzy-match a header to an alias list (case/space/punctuation-insensitive). */
function headerMatches(header: string, aliases: string[]): boolean {
  const h = header.trim().toLowerCase().replace(/[_\-\s]+/g, ' ');
  return aliases.some((a) => h === a || h.replace(/\s+/g, '') === a.replace(/\s+/g, ''));
}

/** Detect the email column from headers (TICKET-004 / -005). */
export function detectEmailColumn(headers: string[]): string | null {
  for (const h of headers) {
    if (headerMatches(h, AUTO_MAP_ALIASES.email!)) return h;
  }
  return null;
}

/** Auto-detect a column for a given token name. */
export function detectColumnForToken(token: string, headers: string[]): string | null {
  const aliases = AUTO_MAP_ALIASES[token];
  if (aliases) {
    for (const h of headers) if (headerMatches(h, aliases)) return h;
  }
  // Fall back to an exact (case-insensitive) header match.
  const exact = headers.find((h) => h.trim().toLowerCase() === token.toLowerCase());
  return exact ?? null;
}

/**
 * Produce the initial token→column mappings for the mapper UI: always an
 * `email` mapping (required), plus one per token found in the body.
 */
export function autoDetectMappings(
  headers: string[],
  tokenSchema: string[],
): TokenMapping[] {
  const mappings: TokenMapping[] = [];
  const emailCol = detectEmailColumn(headers);
  mappings.push({ token: 'email', column: emailCol, auto: emailCol !== null });
  for (const token of tokenSchema) {
    if (token === 'email') continue;
    const col = detectColumnForToken(token, headers);
    mappings.push({ token, column: col, auto: col !== null });
  }
  return mappings;
}

/**
 * Translate a recipient's column-keyed `fields` into a token-keyed record the
 * render engine expects, using the campaign's column→token mappings. Body
 * tokens with no mapped column are simply absent (the renderer then applies the
 * inline fallback, or flags them missing).
 */
export function tokenValuesFor(
  fields: Record<string, string>,
  mappings: TokenMapping[],
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const m of mappings) {
    if (m.token === 'email' || !m.column) continue;
    out[m.token] = fields[m.column] ?? '';
  }
  return out;
}

export interface ImportSummary {
  total: number;
  valid: number;
  invalidEmail: number;
  missingEmail: number;
  duplicate: number;
}

export interface BuiltRecipients {
  recipients: Recipient[];
  summary: ImportSummary;
}

/**
 * Build recipient rows from parsed table rows, using `emailColumn` as the
 * address source. Malformed/missing emails and duplicates are marked `skipped`
 * with a reason (never silently dropped) — SECURITY_AND_ACCESS §4.4.
 */
export function buildRecipients(
  campaignId: string,
  rows: Record<string, string>[],
  emailColumn: string | null,
): BuiltRecipients {
  const recipients: Recipient[] = [];
  const seen = new Set<string>();
  const summary: ImportSummary = {
    total: rows.length,
    valid: 0,
    invalidEmail: 0,
    missingEmail: 0,
    duplicate: 0,
  };

  for (const row of rows) {
    const rawEmail = emailColumn ? (row[emailColumn] ?? '') : '';
    const email = rawEmail.trim();
    let status: Recipient['status'] = 'pending';
    let skipReason: string | null = null;

    if (!email) {
      status = 'skipped';
      skipReason = 'Missing email';
      summary.missingEmail++;
    } else if (!isValidEmail(email)) {
      status = 'skipped';
      skipReason = 'Invalid email';
      summary.invalidEmail++;
    } else {
      const key = normalizeEmail(email);
      if (seen.has(key)) {
        status = 'skipped';
        skipReason = 'Duplicate';
        summary.duplicate++;
      } else {
        seen.add(key);
        summary.valid++;
      }
    }

    recipients.push({
      id: uuid(),
      campaignId,
      email,
      fields: { ...row },
      status,
      attempts: 0,
      lastError: null,
      skipReason,
      gmailMessageId: null,
      sentAt: null,
    });
  }

  return { recipients, summary };
}
