import Papa from 'papaparse';
import type { Campaign, Recipient } from '@fanout/shared';

/**
 * Guard against CSV formula injection (SECURITY_AND_ACCESS §5.2): a value that
 * starts with = + - @ (or tab/CR) can execute if opened in a spreadsheet.
 * Prefix such values with a single quote so they're treated as text.
 */
function sanitizeCell(value: string): string {
  if (/^[=+\-@\t\r]/.test(value)) return `'${value}`;
  return value;
}

/** Build a results CSV (status + reason + message id + original fields). */
export function buildResultsCsv(campaign: Campaign, recipients: Recipient[]): string {
  const rows = recipients.map((r) => {
    const base: Record<string, string> = {
      email: sanitizeCell(r.email),
      status: r.status,
      reason: sanitizeCell(r.lastError ?? r.skipReason ?? ''),
      gmail_message_id: r.gmailMessageId ?? '',
      sent_at: r.sentAt ? new Date(r.sentAt).toISOString() : '',
    };
    for (const h of campaign.headers) base[h] = sanitizeCell(r.fields[h] ?? '');
    return base;
  });
  return Papa.unparse(rows);
}

/** Trigger a client-side download of the results CSV. */
export function downloadResultsCsv(campaign: Campaign, recipients: Recipient[]): void {
  const csv = buildResultsCsv(campaign, recipients);
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const safeName = (campaign.name || 'campaign').replace(/[^a-z0-9]+/gi, '-').slice(0, 40);
  a.href = url;
  a.download = `fanout-${safeName}-results.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
