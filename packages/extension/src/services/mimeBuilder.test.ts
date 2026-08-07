import { describe, it, expect } from 'vitest';
import { buildRawMessage } from './mimeBuilder';

function decodeBase64Url(s: string): string {
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/');
  const pad = b64.length % 4 ? '='.repeat(4 - (b64.length % 4)) : '';
  return Buffer.from(b64 + pad, 'base64').toString('utf-8');
}

function decodeBodyPart(raw: string, contentType: string): string {
  const msg = decodeBase64Url(raw);
  const idx = msg.indexOf(contentType);
  const afterHeaders = msg.indexOf('\r\n\r\n', idx) + 4;
  const end = msg.indexOf('\r\n--fanout', afterHeaders);
  const b64 = msg.slice(afterHeaders, end === -1 ? undefined : end).replace(/\r\n/g, '');
  return Buffer.from(b64, 'base64').toString('utf-8');
}

describe('buildRawMessage', () => {
  it('produces a base64url string with a single recipient and both body parts', () => {
    const raw = buildRawMessage({
      fromName: 'Sam Founder',
      fromEmail: 'sam@co.com',
      toName: 'Jordan Lee',
      toEmail: 'jordan@acme.com',
      subject: 'Hello Jordan',
      bodyText: 'Hi Jordan, plain.',
      bodyHtml: '<p>Hi Jordan, html.</p>',
    });
    // base64url alphabet only.
    expect(raw).toMatch(/^[A-Za-z0-9_-]+$/);

    const msg = decodeBase64Url(raw);
    expect(msg).toContain('From: Sam Founder <sam@co.com>');
    expect(msg).toContain('To: Jordan Lee <jordan@acme.com>');
    expect(msg).toContain('Subject: Hello Jordan');
    expect(msg).toContain('multipart/alternative');
    // Exactly one recipient — no CC/BCC ever.
    expect(msg).not.toMatch(/\r\nCc:/i);
    expect(msg).not.toMatch(/\r\nBcc:/i);

    expect(decodeBodyPart(raw, 'text/plain')).toBe('Hi Jordan, plain.');
    expect(decodeBodyPart(raw, 'text/html')).toBe('<p>Hi Jordan, html.</p>');
  });

  it('encodes non-ASCII subjects as RFC 2047 encoded-words', () => {
    const raw = buildRawMessage({
      fromName: 'Sam',
      fromEmail: 'sam@co.com',
      toEmail: 'j@a.com',
      subject: 'Café ☕',
      bodyText: 'x',
      bodyHtml: '<p>x</p>',
    });
    const msg = decodeBase64Url(raw);
    expect(msg).toMatch(/Subject: =\?UTF-8\?B\?[A-Za-z0-9+/=]+\?=/);
  });

  it('preserves UTF-8 body content (José / 田中)', () => {
    const raw = buildRawMessage({
      fromName: 'Sam',
      fromEmail: 'sam@co.com',
      toEmail: 'j@a.com',
      subject: 's',
      bodyText: 'Hola José',
      bodyHtml: '<p>田中さん</p>',
    });
    expect(decodeBodyPart(raw, 'text/plain')).toBe('Hola José');
    expect(decodeBodyPart(raw, 'text/html')).toBe('<p>田中さん</p>');
  });

  it('wraps the body + attachment in multipart/mixed and preserves attachment bytes', () => {
    const content = 'PDF-ish attachment payload — with UTF-8: café ☕';
    const attB64In = Buffer.from(content, 'utf-8').toString('base64');
    const raw = buildRawMessage({
      fromName: 'Sam',
      fromEmail: 'sam@co.com',
      toEmail: 'j@a.com',
      subject: 's',
      bodyText: 'body',
      bodyHtml: '<p>body</p>',
      attachments: [
        { name: 'deck.pdf', mimeType: 'application/pdf', size: content.length, data: attB64In },
      ],
    });
    const msg = decodeBase64Url(raw);

    // Envelope is multipart/mixed with the alternative body nested inside it.
    expect(msg).toContain('multipart/mixed');
    expect(msg).toContain('multipart/alternative');
    expect(msg).toContain('Content-Disposition: attachment; filename="deck.pdf"');
    expect(msg).toContain('Content-Type: application/pdf; name="deck.pdf"');

    // Body parts survive.
    expect(decodeBodyPart(raw, 'text/plain')).toBe('body');

    // The attachment's base64 round-trips back to the original bytes.
    const disp = msg.indexOf('Content-Disposition: attachment');
    const start = msg.indexOf('\r\n\r\n', disp) + 4;
    const end = msg.indexOf('\r\n--fanout-mixed', start);
    const attB64Out = msg.slice(start, end).replace(/\r\n/g, '');
    expect(Buffer.from(attB64Out, 'base64').toString('utf-8')).toBe(content);
  });

  it('omits the mixed envelope when there are no attachments', () => {
    const raw = buildRawMessage({
      fromName: 'Sam',
      fromEmail: 'sam@co.com',
      toEmail: 'j@a.com',
      subject: 's',
      bodyText: 'x',
      bodyHtml: '<p>x</p>',
      attachments: [],
    });
    const msg = decodeBase64Url(raw);
    expect(msg).toContain('multipart/alternative');
    expect(msg).not.toContain('multipart/mixed');
  });
});
