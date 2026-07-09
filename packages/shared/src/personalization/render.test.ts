import { describe, it, expect } from 'vitest';
import { extractTokens, tokenSchema } from './parse';
import { renderTemplate, renderEmail, escapeHtml } from './render';

describe('extractTokens', () => {
  it('finds distinct tokens with and without fallbacks', () => {
    const toks = extractTokens('Hi {{FirstName}} at {{Company|your company}}');
    expect(toks).toEqual([
      { name: 'FirstName', fallback: null },
      { name: 'Company', fallback: 'your company' },
    ]);
  });

  it('prefers the fallback when a token appears both ways', () => {
    const toks = extractTokens('{{Name}} ... {{Name|there}}');
    expect(toks).toEqual([{ name: 'Name', fallback: 'there' }]);
  });

  it('tolerates internal whitespace', () => {
    expect(extractTokens('{{ First Name }}')).toEqual([
      { name: 'First Name', fallback: null },
    ]);
  });
});

describe('tokenSchema', () => {
  it('unions tokens across subject and body', () => {
    expect(tokenSchema('Hello {{FirstName}}', '<p>from {{Company}}</p>')).toEqual([
      'FirstName',
      'Company',
    ]);
  });
});

describe('renderTemplate', () => {
  it('substitutes values and reports no missing', () => {
    const r = renderTemplate('Hi {{FirstName}}', { FirstName: 'Sam' }, { html: false });
    expect(r.text).toBe('Hi Sam');
    expect(r.missing).toEqual([]);
  });

  it('uses the inline fallback when the value is empty', () => {
    const r = renderTemplate('Hi {{FirstName|there}}', { FirstName: '' }, { html: false });
    expect(r.text).toBe('Hi there');
    expect(r.missing).toEqual([]);
  });

  it('reports missing when empty and no fallback — never leaks the token', () => {
    const r = renderTemplate('Hi {{FirstName}}', {}, { html: false });
    expect(r.text).toBe('Hi ');
    expect(r.missing).toEqual(['FirstName']);
  });

  it('escapes untrusted values in HTML mode', () => {
    const r = renderTemplate(
      '<p>{{Name}}</p>',
      { Name: '<script>alert(1)</script>' },
      { html: true },
    );
    expect(r.text).toBe('<p>&lt;script&gt;alert(1)&lt;/script&gt;</p>');
  });

  it('does not escape in text mode', () => {
    const r = renderTemplate('{{Name}}', { Name: 'A & B' }, { html: false });
    expect(r.text).toBe('A & B');
  });
});

describe('renderEmail', () => {
  it('renders all three fields and unions missing tokens', () => {
    const out = renderEmail(
      {
        subject: 'Hi {{FirstName}}',
        bodyHtml: '<p>from {{Company}}</p>',
        bodyText: 'from {{Company}}',
      },
      { FirstName: 'Sam' },
    );
    expect(out.subject).toBe('Hi Sam');
    expect(out.missing).toEqual(['Company']);
  });
});

describe('escapeHtml', () => {
  it('escapes the five significant characters', () => {
    expect(escapeHtml(`<>&"'`)).toBe('&lt;&gt;&amp;&quot;&#39;');
  });
});
