/**
 * Hand-rolled RFC 2822 → base64url builder for Gmail's messages.send `raw`
 * field (ARCHITECTURE §2.1, FRONTEND_SPEC §8.2). multipart/alternative,
 * UTF-8 end-to-end, base64 body transfer-encoding (predictable vs. QP).
 * Exactly ONE recipient per message — never CC/BCC (PRD §1).
 */

const encoder = new TextEncoder();

function toBase64(bytes: Uint8Array): string {
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

function base64url(input: string): string {
  const b64 = toBase64(encoder.encode(input));
  return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function isAscii(s: string): boolean {
  // eslint-disable-next-line no-control-regex
  return /^[\x00-\x7F]*$/.test(s);
}

/** RFC 2047 encoded-word for non-ASCII header text. */
function encodeHeaderWord(text: string): string {
  if (isAscii(text)) return text;
  return `=?UTF-8?B?${toBase64(encoder.encode(text))}?=`;
}

/** Format a `Display Name <email>` header value safely. */
function formatAddress(name: string, email: string): string {
  const trimmed = name.trim();
  if (!trimmed) return email;
  if (isAscii(trimmed)) {
    // Quote names containing specials so parsers don't choke.
    const needsQuote = /[(),<>@:;."[\]]/.test(trimmed);
    return `${needsQuote ? `"${trimmed.replace(/"/g, '\\"')}"` : trimmed} <${email}>`;
  }
  return `${encodeHeaderWord(trimmed)} <${email}>`;
}

/** base64-encode a body and wrap to 76-char lines per RFC. */
function encodeBody(text: string): string {
  const b64 = toBase64(encoder.encode(text));
  return b64.replace(/.{76}/g, '$&\r\n');
}

export interface MimeInput {
  fromName: string;
  fromEmail: string;
  toName?: string;
  toEmail: string;
  subject: string;
  bodyText: string;
  bodyHtml: string;
}

export function buildRawMessage(input: MimeInput): string {
  const boundary = `fanout-${crypto.randomUUID()}`;
  const headers = [
    `From: ${formatAddress(input.fromName, input.fromEmail)}`,
    `To: ${formatAddress(input.toName ?? '', input.toEmail)}`,
    `Subject: ${encodeHeaderWord(input.subject)}`,
    'MIME-Version: 1.0',
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
  ];
  const parts = [
    `--${boundary}`,
    'Content-Type: text/plain; charset="UTF-8"',
    'Content-Transfer-Encoding: base64',
    '',
    encodeBody(input.bodyText),
    '',
    `--${boundary}`,
    'Content-Type: text/html; charset="UTF-8"',
    'Content-Transfer-Encoding: base64',
    '',
    encodeBody(input.bodyHtml),
    `--${boundary}--`,
  ];
  const message = [...headers, '', ...parts].join('\r\n');
  return base64url(message);
}
