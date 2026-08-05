import type { Campaign, Template } from '../types/index';
import { tokenSchema } from '../personalization/parse';

/**
 * The campaign patch that applying a template produces (TICKET-017).
 * `tokenSchema` is recomputed from the template's own content so an applied
 * template never inherits a stale token list from the campaign it replaces.
 * Framework-free and pure so any surface can use it.
 */
export function templateApplyPatch(
  t: Template,
): Pick<Campaign, 'subject' | 'bodyHtml' | 'bodyText' | 'tokenSchema'> {
  return {
    subject: t.subject,
    bodyHtml: t.bodyHtml,
    bodyText: t.bodyText,
    tokenSchema: tokenSchema(t.subject, t.bodyHtml),
  };
}
