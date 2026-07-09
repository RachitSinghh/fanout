import type { Campaign, Recipient } from '@fanout/shared';
import { renderEmail, type RenderedEmail } from '@fanout/shared';
import { tokenValuesFor } from './recipients';

/** Render the email exactly as it will send for one recipient. */
export function renderForRecipient(campaign: Campaign, recipient: Recipient): RenderedEmail {
  const values = tokenValuesFor(recipient.fields, campaign.columnMappings);
  return renderEmail(
    { subject: campaign.subject, bodyHtml: campaign.bodyHtml, bodyText: campaign.bodyText },
    values,
  );
}

/** Only rows that will actually be sent (valid, not skipped). */
export function sendableRecipients(recipients: Recipient[]): Recipient[] {
  return recipients.filter((r) => r.status === 'pending' || r.status === 'sending' || r.status === 'sent');
}

/**
 * Union of tokens that would render EMPTY with no fallback for at least one
 * sendable recipient — these block the send (never leak "Hi {{FirstName}}",
 * SECURITY_AND_ACCESS §4.4). Matches the engine's per-occurrence semantics.
 */
export function findBlockingTokens(campaign: Campaign, recipients: Recipient[]): string[] {
  const sendable = sendableRecipients(recipients);
  const missing = new Set<string>();
  // Number of distinct body/subject tokens (excluding email) bounds early-exit.
  const tokenCount = campaign.tokenSchema.filter((t) => t !== 'email').length;
  for (const r of sendable) {
    const out = renderForRecipient(campaign, r);
    for (const m of out.missing) missing.add(m);
    if (missing.size >= tokenCount && tokenCount > 0) break;
  }
  return [...missing];
}
