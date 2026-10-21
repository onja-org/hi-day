import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiClient, isTransportFailure } from '../api-client';

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

describe('ApiClient timers without a project', () => {
  function stubOk() {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify({ id: 'e1' }), { status: 201 }));
    vi.stubGlobal('fetch', fetchMock);
    return fetchMock;
  }

  it('starts on the project-less route when no project is given', async () => {
    const fetchMock = stubOk();

    await new ApiClient(BASE_URL).startTimer('t', null, null);

    expect(fetchMock.mock.calls[0][0]).toBe(`${BASE_URL}/device/time-entries/start`);
  });

  it('still starts on the project route when one is given', async () => {
    const fetchMock = stubOk();

    await new ApiClient(BASE_URL).startTimer('t', 'p1', null);

    expect(fetchMock.mock.calls[0][0]).toBe(`${BASE_URL}/device/projects/p1/time-entries/start`);
  });

  it('leaves the project out of a switch body when there is none', async () => {
    const fetchMock = stubOk();

    await new ApiClient(BASE_URL).switchTimer('t', null, null);

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(init.body).toBe(JSON.stringify({}));
  });

  it('reads the projects setting from its own endpoint', async () => {
    const fetchMock = stubOk();

    await new ApiClient(BASE_URL).getProjectsSetting('t');

    expect(fetchMock.mock.calls[0][0]).toBe(`${BASE_URL}/device/projects-setting`);
  });
});

/**
 * Offline is a supported state, so it needs to be reachable on purpose
 * rather than by unplugging a cable at the right moment (docs/adr/0025-...).
 * The switch sits in front of every request, which is what makes what it
 * produces the real thing: a transport failure, with no HTTP status.
 */
describe('ApiClient when offline is simulated', () => {
  const offlineClient = () => new ApiClient(BASE_URL, () => true);

  it('never reaches the network at all', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    await offlineClient().listProjects('t');

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('fails the way an unreachable server does, with no status', async () => {
    vi.stubGlobal('fetch', vi.fn());

    const result = await offlineClient().listProjects('t');

    // The absence of a status is load-bearing: it is how callers tell
    // "try again later" from "the server refused this and always will".
    expect(result.ok).toBe(false);
    expect(result.ok === false && result.status).toBeUndefined();
    expect(result.ok === false && result.unauthorized).toBeUndefined();
  });

  it('refuses to start a pairing, saying what the person can act on', async () => {
    vi.stubGlobal('fetch', vi.fn());

    const result = await offlineClient().startPairing({
      deviceFingerprint: 'f',
      platform: 'linux',
      osVersion: '1',
      hostname: 'h',
      appVersion: '1.0.0',
    });

    expect(result.ok).toBe(false);
    // Logging in genuinely cannot work offline, and a server URL is not
    // something anyone reading the login screen can do anything with.
    expect(result.ok === false && result.message).not.toContain(BASE_URL);
    expect(result.ok === false && result.message).toContain('internet');
  });

  it('reports a failed heartbeat rather than pretending one landed', async () => {
    vi.stubGlobal('fetch', vi.fn());

    expect(await offlineClient().heartbeat('t', '1.0.0')).toBe(false);
  });
});

describe('isTransportFailure', () => {
  it('is true only when nothing reached the server', () => {
    expect(isTransportFailure({ ok: false, message: 'unreachable' })).toBe(true);
  });

  it('is false for a refusal, which repeating cannot change', () => {
    expect(
      isTransportFailure({ ok: false, message: 'too old', status: 400 }),
    ).toBe(false);
  });

  it('is false for a sign-out, which is an answer', () => {
    expect(
      isTransportFailure({
        ok: false,
        message: 'signed out',
        unauthorized: true,
      }),
    ).toBe(false);
  });

  it('is false for a success', () => {
    expect(isTransportFailure({ ok: true, data: null })).toBe(false);
  });
});
