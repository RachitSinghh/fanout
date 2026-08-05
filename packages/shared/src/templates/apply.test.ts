import { describe, it, expect } from 'vitest';
import { templateApplyPatch } from './index';
import type { Template } from '../types/index';

function tpl(over: Partial<Template>): Template {
  return {
    id: 't1',
    name: 'Outreach',
    subject: 'Hi {{FirstName}}',
    bodyHtml: '<p>Hello {{FirstName}} at {{Company}}</p>',
    bodyText: 'Hello {{FirstName}} at {{Company}}',
    createdAt: 0,
    updatedAt: 0,
    ...over,
  };
}

describe('templateApplyPatch', () => {
  it('carries subject/body through unchanged', () => {
    const t = tpl({});
    const patch = templateApplyPatch(t);
    expect(patch.subject).toBe(t.subject);
    expect(patch.bodyHtml).toBe(t.bodyHtml);
    expect(patch.bodyText).toBe(t.bodyText);
  });

  it('recomputes the token schema from the template content (not stale)', () => {
    const patch = templateApplyPatch(tpl({}));
    // Tokens come from subject + bodyHtml, de-duplicated.
    expect(patch.tokenSchema.sort()).toEqual(['Company', 'FirstName']);
  });

  it('yields an empty schema when the template has no tokens', () => {
    const patch = templateApplyPatch(
      tpl({ subject: 'Hello', bodyHtml: '<p>No tokens here</p>', bodyText: 'No tokens here' }),
    );
    expect(patch.tokenSchema).toEqual([]);
  });
});
