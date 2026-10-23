import { describe, expect, it, vi } from 'vitest';
import { syncWithOlderBackendFallback, type SyncAttempt } from '../older-backend-fallback';
import type { UrlSession } from '../session-types';

function session(id: string, confidence: UrlSession['confidence'] = 'displayed'): UrlSession {
  return {
    id,
    url: confidence === 'unknown' ? '' : 'example.com',
    host: confidence === 'unknown' ? '' : 'example.com',
    path: null,
    title: null,
    browser: 'chrome',
    private: null,
    deviceId: 'device-1',
    startedAt: 1,
    endedAt: 2,
    activeMs: 1,
    tzOffsetMin: 0,
    source: 'atspi',
    confidence,
  };
}

/** Accepts only batches with no unknown-URL session, like a backend that predates it. */
const olderBackend = vi.fn(
  (sessions: UrlSession[]): Promise<SyncAttempt> =>
    Promise.resolve(
      sessions.some((s) => s.confidence === 'unknown')
        ? { ok: false, status: 400 }
        : { ok: true, acked: sessions.map((s) => s.id) },
    ),
);

describe('syncWithOlderBackendFallback', () => {
  it('sends a batch once when it is accepted', async () => {
    const send = vi.fn(() => Promise.resolve<SyncAttempt>({ ok: true, acked: ['a', 'u'] }));
    const result = await syncWithOlderBackendFallback([session('a'), session('u', 'unknown')], send);
    expect(result).toEqual({ ok: true, acked: ['a', 'u'] });
    expect(send).toHaveBeenCalledTimes(1);
  });

  it('resends without unknown-URL sessions after a 400, and acks them so they do not block the queue', async () => {
    olderBackend.mockClear();
    const result = await syncWithOlderBackendFallback(
      [session('a'), session('u', 'unknown'), session('b')],
      olderBackend,
    );
    expect(result).toEqual({ ok: true, acked: ['a', 'b', 'u'] });
    expect(olderBackend).toHaveBeenCalledTimes(2);
  });

  it('acks a batch of only unknown-URL sessions without a second request', async () => {
    olderBackend.mockClear();
    const result = await syncWithOlderBackendFallback([session('u', 'unknown')], olderBackend);
    expect(result).toEqual({ ok: true, acked: ['u'] });
    expect(olderBackend).toHaveBeenCalledTimes(1);
  });

  it('leaves any other failure alone, so an outage still retries everything', async () => {
    const send = vi.fn(() => Promise.resolve<SyncAttempt>({ ok: false, status: 503 }));
    const result = await syncWithOlderBackendFallback([session('u', 'unknown')], send);
    expect(result).toEqual({ ok: false, status: 503 });
    expect(send).toHaveBeenCalledTimes(1);
  });

  it('does not retry a 400 that unknown-URL sessions cannot explain', async () => {
    const send = vi.fn(() => Promise.resolve<SyncAttempt>({ ok: false, status: 400 }));
    await syncWithOlderBackendFallback([session('a')], send);
    expect(send).toHaveBeenCalledTimes(1);
  });
});
