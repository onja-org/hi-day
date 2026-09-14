import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiClient } from '../api-client';

const BASE_URL = 'https://api.example.com';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('ApiClient#heartbeat', () => {
  it('POSTs to /devices/heartbeat with the bearer token and appVersion, returning true on success', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    const client = new ApiClient(BASE_URL);
    const result = await client.heartbeat('device-token-123', '1.2.3');

    expect(result).toBe(true);
    expect(fetchMock).toHaveBeenCalledWith(
      `${BASE_URL}/devices/heartbeat`,
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ appVersion: '1.2.3' }),
      }),
    );
    const [, requestInit] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(requestInit.headers).toEqual(
      expect.objectContaining({ Authorization: 'Bearer device-token-123' }),
    );
  });

  it('returns false when the server responds with a non-ok status', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status: 401 })));

    const client = new ApiClient(BASE_URL);
    const result = await client.heartbeat('stale-token', '1.2.3');

    expect(result).toBe(false);
  });

  it('returns false (never throws) when the network request itself fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network down')));

    const client = new ApiClient(BASE_URL);
    const result = await client.heartbeat('device-token-123', '1.2.3');

    expect(result).toBe(false);
  });
});

describe('ApiClient device requests — HTTP status is surfaced for classification', () => {
  it('reports the status on a 400 so a caller can tell a rejected payload from an outage', () => {
    // The distinction this exists for: a 400 will fail identically on every
    // retry, while an unreachable server will not. Without the status they
    // are indistinguishable, which is how a validation bug hid behind a
    // silent retry loop.
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ message: ['activeMs must be an integer number'] }), { status: 400 }),
      ),
    );

    return new ApiClient(BASE_URL).syncUrlSessions('token', []).then((result) => {
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.status).toBe(400);
        expect(result.unauthorized).toBe(false);
        expect(result.message).toBe('activeMs must be an integer number');
      }
    });
  });

  it('leaves status undefined when the request never reached the server', () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network down')));

    return new ApiClient(BASE_URL).syncUrlSessions('token', []).then((result) => {
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.status).toBeUndefined();
    });
  });
});

describe('ApiClient device requests — unauthorized detection', () => {
  it('flags unauthorized: true only for a real 401 (e.g. an admin-revoked session)', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ message: "You've been signed out — please log in to continue." }), {
          status: 401,
        }),
      ),
    );

    const client = new ApiClient(BASE_URL);
    const result = await client.getCurrentTimer('revoked-token');

    expect(result).toEqual({
      ok: false,
      message: "You've been signed out — please log in to continue.",
      runningEntry: undefined,
      unauthorized: true,
      status: 401,
    });
  });

  it('does not flag unauthorized for an ordinary error status (e.g. 400/500)', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response(JSON.stringify({ message: 'Something went wrong.' }), { status: 500 })),
    );

    const client = new ApiClient(BASE_URL);
    const result = await client.getCurrentTimer('device-token-123');

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.unauthorized).toBe(false);
    }
  });

  it('leaves unauthorized undefined/false on a successful request', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response(JSON.stringify({ entry: null, now: '2024-01-01T00:00:00.000Z' }), { status: 200 })),
    );

    const client = new ApiClient(BASE_URL);
    const result = await client.getCurrentTimer('device-token-123');

    expect(result.ok).toBe(true);
  });
});
