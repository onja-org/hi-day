import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  ActivitySampleUploaderClient,
  ActivitySampleUploaderSession,
} from '../activity-sample-uploader';
import {
  ActivitySampleUploader,
  MAX_BUFFERED_ACTIVITY_SAMPLES,
} from '../activity-sample-uploader';
import { DEFAULT_MAX_RETRY_DELAY_MS, OfflineQueue } from '../offline-queue';
import { OfflineQueueStore } from '../offline-queue-store';
import type { ActivitySample } from '../activity-sample';

describe('ActivitySampleUploader', () => {
  let store: OfflineQueueStore;

  beforeEach(async () => {
    store = await OfflineQueueStore.create(':memory:');
  });

  afterEach(() => {
    store.close();
  });

  function makeSample(overrides: Partial<ActivitySample> = {}): ActivitySample {
    return {
      activePercentage: 42,
      periodStart: '2026-09-08T12:00:00.000Z',
      periodEnd: '2026-09-08T12:10:00.000Z',
      ...overrides,
    };
  }

  function makeSession(deviceToken: string | null): ActivitySampleUploaderSession {
    return { load: () => (deviceToken ? { deviceToken } : null) };
  }

  function makeClient(
    result: { ok: true } | { ok: false; message: string } = { ok: true },
  ) {
    const postActivitySamples = vi
      .fn()
      .mockResolvedValue({ ...result, data: undefined });
    const client = { postActivitySamples } as unknown as ActivitySampleUploaderClient;
    return { client, postActivitySamples };
  }

  function makeUploader(
    session: ActivitySampleUploaderSession,
    client: ActivitySampleUploaderClient,
  ) {
    const offlineQueue = new OfflineQueue(store);
    const uploader = new ActivitySampleUploader(session, client, offlineQueue);
    offlineQueue.registerSender(uploader);
    return { uploader, offlineQueue };
  }

  it('enqueues a sample and uploads it on flush', async () => {
    const { client, postActivitySamples } = makeClient();
    const { uploader } = makeUploader(makeSession('token-1'), client);

    uploader.enqueue(makeSample());
    await uploader.flush();

    expect(postActivitySamples).toHaveBeenCalledWith('token-1', [
      {
        activePercentage: 42,
        periodStart: '2026-09-08T12:00:00.000Z',
        periodEnd: '2026-09-08T12:10:00.000Z',
      },
    ]);
  });

  it('does nothing on flush when nothing is queued', async () => {
    const { client, postActivitySamples } = makeClient();
    const { uploader } = makeUploader(makeSession('token-1'), client);

    await uploader.flush();

    expect(postActivitySamples).not.toHaveBeenCalled();
  });

  it('leaves the sample queued (not dropped) when there is no session, and sends it once one exists', async () => {
    vi.useFakeTimers();
    try {
      const { client, postActivitySamples } = makeClient();
      const { uploader, offlineQueue } = makeUploader(makeSession(null), client);

      uploader.enqueue(makeSample());
      await uploader.flush();

      expect(postActivitySamples).not.toHaveBeenCalled();
      expect(store.countPending('activity-sample')).toBe(1);

      const { client: secondClient, postActivitySamples: secondPost } =
        makeClient();
      const loggedInUploader = new ActivitySampleUploader(
        makeSession('token-1'),
        secondClient,
        offlineQueue,
      );
      offlineQueue.registerSender(loggedInUploader);
      await vi.advanceTimersByTimeAsync(DEFAULT_MAX_RETRY_DELAY_MS);
      await loggedInUploader.flush();

      expect(secondPost).toHaveBeenCalledTimes(1);
      expect(store.countPending('activity-sample')).toBe(0);
    } finally {
      vi.useRealTimers();
    }
  });

  it('discards (does not retry) a batch rejected with 403 — a permanent rejection, not a transient failure', async () => {
    const postActivitySamples = vi
      .fn()
      .mockResolvedValue({ ok: false, status: 403, message: 'forbidden' });
    const client = {
      postActivitySamples,
    } as unknown as ActivitySampleUploaderClient;
    const { uploader } = makeUploader(makeSession('token-1'), client);

    uploader.enqueue(makeSample());
    await uploader.flush();

    expect(postActivitySamples).toHaveBeenCalledTimes(1);
    expect(store.countPending('activity-sample')).toBe(0);
  });

  it('keeps a sample queued for retry after a failed flush, rather than dropping it', async () => {
    const { client, postActivitySamples } = makeClient({
      ok: false,
      message: 'network error',
    });
    const { uploader } = makeUploader(makeSession('token-1'), client);

    uploader.enqueue(makeSample());
    await uploader.flush();
    await uploader.flush();

    expect(postActivitySamples).toHaveBeenCalledTimes(1);
    expect(store.countPending('activity-sample')).toBe(1);
  });

  it('auto-flushes in batches capped at MAX_BUFFERED_ACTIVITY_SAMPLES per request', async () => {
    const { client, postActivitySamples } = makeClient();
    const { uploader } = makeUploader(makeSession('token-1'), client);

    for (let i = 0; i < MAX_BUFFERED_ACTIVITY_SAMPLES + 1; i++) {
      uploader.enqueue(makeSample());
    }
    await uploader.flush();

    expect(postActivitySamples).toHaveBeenCalledTimes(2);
    expect((postActivitySamples.mock.calls[0] as unknown[])[1]).toHaveLength(
      MAX_BUFFERED_ACTIVITY_SAMPLES,
    );
    expect((postActivitySamples.mock.calls[1] as unknown[])[1]).toHaveLength(1);
  });
});
