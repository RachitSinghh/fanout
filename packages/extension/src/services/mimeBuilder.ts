/**
 * Hand-rolled RFC 2822 → base64url builder for Gmail's messages.send `raw`
 * field (ARCHITECTURE §2.1, FRONTEND_SPEC §8.2). multipart/alternative,
 * UTF-8 end-to-end, base64 body transfer-encoding (predictable vs. QP).
 * Exactly ONE recipient per message — never CC/BCC (PRD §1).
 */

import type { Attachment } from '@fanout/shared';

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

/** Wrap an already-base64 string to 76-char lines per RFC 2045. */
function wrapBase64(b64: string): string {
  return b64.replace(/.{76}/g, '$&\r\n');
}

/** `name=`/`filename=` params for an attachment header; RFC 2231 when non-ASCII. */
function nameParam(name: string): string {
  return isAscii(name) ? `name="${name.replace(/"/g, '')}"` : `name="${encodeHeaderWord(name)}"`;
}
function filenameParam(name: string): string {
  return isAscii(name)
    ? `filename="${name.replace(/"/g, '')}"`
    : `filename*=UTF-8''${encodeURIComponent(name)}`;
}

/** The text+html alternative block (shared whether or not attachments wrap it). */
function alternativeParts(boundary: string, bodyText: string, bodyHtml: string): string[] {
  return [
    `--${boundary}`,
    'Content-Type: text/plain; charset="UTF-8"',
    'Content-Transfer-Encoding: base64',
    '',
    encodeBody(bodyText),
    '',
    `--${boundary}`,
    'Content-Type: text/html; charset="UTF-8"',
    'Content-Transfer-Encoding: base64',
    '',
    encodeBody(bodyHtml),
    `--${boundary}--`,
  ];
}

export interface MimeInput {
  fromName: string;
  fromEmail: string;
  toName?: string;
  toEmail: string;
  subject: string;
  bodyText: string;
  bodyHtml: string;
  /** Files attached to this send (TICKET-018); same for every recipient. */
  attachments?: Attachment[];
}

export function buildRawMessage(input: MimeInput): string {
  const altBoundary = `fanout-alt-${crypto.randomUUID()}`;
  const alt = alternativeParts(altBoundary, input.bodyText, input.bodyHtml);
  const attachments = input.attachments ?? [];

  const addrHeaders = [
    `From: ${formatAddress(input.fromName, input.fromEmail)}`,
    `To: ${formatAddress(input.toName ?? '', input.toEmail)}`,
    `Subject: ${encodeHeaderWord(input.subject)}`,
    'MIME-Version: 1.0',
  ];

  let message: string;
  if (attachments.length === 0) {
    // No attachments — the message body IS the alternative block (as before).
    const headers = [...addrHeaders, `Content-Type: multipart/alternative; boundary="${altBoundary}"`];
    message = [...headers, '', ...alt].join('\r\n');
  } else {
    // Wrap the alternative block + each attachment in a multipart/mixed envelope.
    const mixedBoundary = `fanout-mixed-${crypto.randomUUID()}`;
    const headers = [...addrHeaders, `Content-Type: multipart/mixed; boundary="${mixedBoundary}"`];
    const body: string[] = [
      `--${mixedBoundary}`,
      `Content-Type: multipart/alternative; boundary="${altBoundary}"`,
      '',
      ...alt,
    ];
    for (const att of attachments) {
      body.push(
        `--${mixedBoundary}`,
        `Content-Type: ${att.mimeType || 'application/octet-stream'}; ${nameParam(att.name)}`,
        'Content-Transfer-Encoding: base64',
        `Content-Disposition: attachment; ${filenameParam(att.name)}`,
        '',
        wrapBase64(att.data),
      );
    }
    body.push(`--${mixedBoundary}--`);
    message = [...headers, '', ...body].join('\r\n');
  }
  return base64url(message);
}
