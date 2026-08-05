import { describe, it, expect, vi, beforeEach } from 'vitest';

// Auth is Chrome-broker-backed; stub it so the client is testable in isolation.
vi.mock('../services/authService', () => ({
  getAccessToken: vi.fn(async () => 'tok'),
  refreshAccessToken: vi.fn(async () => 'tok2'),
}));

import { sendRawEmail } from './gmailClient';
import { getAccessToken, refreshAccessToken } from '../services/authService';

function jsonResponse(status: number, body: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as unknown as Response;
}

beforeEach(() => {
  vi.clearAllMocks();
  (getAccessToken as ReturnType<typeof vi.fn>).mockResolvedValue('tok');
});

describe('sendRawEmail', () => {
  it('returns the message id on success', async () => {
    global.fetch = vi.fn(async () => jsonResponse(200, { id: 'msg-1' })) as unknown as typeof fetch;
    const r = await sendRawEmail('raw');
    expect(r).toEqual({ ok: true, messageId: 'msg-1' });
  });

  // The regression this file exists for: a fetch rejection must not escape.
  it('classifies a network rejection as transient (not thrown)', async () => {
    global.fetch = vi.fn(async () => {
      throw new TypeError('Failed to fetch');
    }) as unknown as typeof fetch;
    const r = await sendRawEmail('raw');
    expect(r).toMatchObject({ ok: false, bucket: 'transient', httpStatus: null, errorCode: 'network' });
  });

  it('maps status codes to buckets', async () => {
    const cases: Array<[number, string]> = [
      [429, 'transient'],
      [503, 'transient'],
      [403, 'account'],
      [400, 'permanent'],
      [418, 'permanent'], // unknown 4xx → permanent, never hammer Google
    ];
    for (const [status, bucket] of cases) {
      global.fetch = vi.fn(async () =>
        jsonResponse(status, { error: { message: 'nope' } }),
      ) as unknown as typeof fetch;
      const r = await sendRawEmail('raw');
      expect(r).toMatchObject({ ok: false, bucket });
    }
  });

  it('refreshes the token once on 401 then retries', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(401, { error: { message: 'expired' } }))
      .mockResolvedValueOnce(jsonResponse(200, { id: 'msg-2' }));
    global.fetch = fetchMock as unknown as typeof fetch;
    const r = await sendRawEmail('raw');
    expect(refreshAccessToken).toHaveBeenCalledOnce();
    expect(r).toEqual({ ok: true, messageId: 'msg-2' });
  });

  it('surfaces auth error when the retry post also fails to reach Gmail', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(401, { error: { message: 'expired' } }))
      .mockRejectedValueOnce(new TypeError('Failed to fetch'));
    global.fetch = fetchMock as unknown as typeof fetch;
    const r = await sendRawEmail('raw');
    // Refresh succeeded but the retry send hit the network — transient, not auth.
    expect(r).toMatchObject({ ok: false, bucket: 'transient', errorCode: 'network' });
  });

  it('returns auth bucket when no token is available', async () => {
    (getAccessToken as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('no token'));
    global.fetch = vi.fn() as unknown as typeof fetch;
    const r = await sendRawEmail('raw');
    expect(r).toMatchObject({ ok: false, bucket: 'auth', errorCode: 'noToken' });
  });
});
