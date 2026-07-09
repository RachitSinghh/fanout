import { TOKEN_REGEX } from '../constants/tokens';

/** Escape a raw imported value before it enters an HTML email body. Every
 *  imported value is untrusted (SECURITY_AND_ACCESS §5.2). */
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export interface RenderResult {
  text: string;
  /** Token names that resolved to an empty value with no fallback. */
  missing: string[];
}

interface RenderOptions {
  /** When true, escape substituted values for safe HTML embedding. */
  html: boolean;
}

/**
 * Render a template for one recipient, substituting {{Token}} / {{Token|fallback}}.
 * Resolution order per token: recipient field value → inline fallback → "".
 * A token that resolves to empty with no fallback is reported in `missing` so
 * the UI can block the send (never leak a literal {{Token}}).
 */
export function renderTemplate(
  template: string,
  fields: Record<string, string>,
  opts: RenderOptions,
): RenderResult {
  const missing = new Set<string>();
  TOKEN_REGEX.lastIndex = 0;
  const text = template.replace(
    TOKEN_REGEX,
    (_full, rawName: string, rawFallback: string | undefined) => {
      const name = rawName.trim();
      const raw = fields[name];
      const value = raw !== undefined ? raw.trim() : '';
      if (value !== '') {
        return opts.html ? escapeHtml(value) : value;
      }
      if (rawFallback !== undefined) {
        const fb = rawFallback;
        return opts.html ? escapeHtml(fb) : fb;
      }
      missing.add(name);
      return '';
    },
  );
  return { text, missing: [...missing] };
}

export interface RenderedEmail {
  subject: string;
  bodyHtml: string;
  bodyText: string;
  /** Union of missing tokens across all three fields. */
  missing: string[];
}

/** Render subject + HTML body + text body for one recipient in one pass. */
export function renderEmail(
  campaign: { subject: string; bodyHtml: string; bodyText: string },
  fields: Record<string, string>,
): RenderedEmail {
  const subject = renderTemplate(campaign.subject, fields, { html: false });
  const bodyHtml = renderTemplate(campaign.bodyHtml, fields, { html: true });
  const bodyText = renderTemplate(campaign.bodyText, fields, { html: false });
  const missing = new Set<string>([
    ...subject.missing,
    ...bodyHtml.missing,
    ...bodyText.missing,
  ]);
  return {
    subject: subject.text,
    bodyHtml: bodyHtml.text,
    bodyText: bodyText.text,
    missing: [...missing],
  };
}
