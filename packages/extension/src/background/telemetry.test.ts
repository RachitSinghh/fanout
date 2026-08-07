import { describe, it, expect } from 'vitest';
import type { Campaign } from '@fanout/shared';
import { buildTelemetry } from './telemetry';

function campaign(over: Partial<Campaign> = {}): Campaign {
  return {
    id: 'c-1',
    name: 'July outreach',
    subject: 'Hi {{FirstName}}',
    bodyHtml: '<p>hi</p>',
    bodyText: 'hi',
    fromEmail: 'me@example.com',
    fromName: 'Me',
    tokenSchema: [],
    columnMappings: [],
    headers: [],
    status: 'completed',
    pauseReason: null,
    accountError: null,
    scheduledAt: null,
    attachments: [],
    throttle: { minMs: 1, maxMs: 1, mode: 'fixed' },
    dailyCap: null,
    totalRecipients: 3,
    sentCount: 2,
    failedCount: 1,
    skippedCount: 0,
    createdAt: 0,
    updatedAt: 0,
    completedAt: 0,
    ...over,
  };
}

describe('buildTelemetry', () => {
  it('reports counts + error codes and the opaque campaign ref', () => {
    const t = buildTelemetry(campaign(), ['rateLimitExceeded'], '0.1.0');
    expect(t).toEqual({
      campaignRef: 'c-1',
      attempted: 3,
      sent: 2,
      failed: 1,
      skipped: 0,
      errorCodes: ['rateLimitExceeded'],
      extVersion: '0.1.0',
    });
  });

  it('never carries PII — no recipient-shaped value in the payload', () => {
    // Campaign holds fromEmail/subject/body; the telemetry payload must not.
    const t = buildTelemetry(campaign({ fromEmail: 'secret@user.com' }), [], '0.1.0');
    expect(JSON.stringify(t)).not.toMatch(/@/);
    expect(JSON.stringify(t)).not.toContain('FirstName'); // no subject/body leakage
  });
});
