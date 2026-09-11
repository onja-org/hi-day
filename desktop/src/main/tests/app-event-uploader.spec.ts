import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AppEventUploaderClient, AppEventUploaderSession } from '../app-event-uploader';
import { AppEventUploader, MAX_BUFFERED_APP_EVENTS } from '../app-event-uploader';
import { DEFAULT_MAX_RETRY_DELAY_MS, OfflineQueue } from '../offline-queue';
import { OfflineQueueStore } from '../offline-queue-store';
import type { WindowSample } from '../window-sample';

describe('AppEventUploader', () => {
  let store: OfflineQueueStore;

  beforeEach(async () => {
    store = await OfflineQueueStore.create(':memory:');
  });

  afterEach(() => {
    store.close();
  });

  function makeSample(overrides: Partial<WindowSample> = {}): WindowSample {
    return {
      appName: 'Google Chrome',
      title: 'Gmail',
      titleUnavailableReason: null,
      sampledAt: '2026-09-08T12:00:00.000Z',
      ...overrides,
    };
  }

  function makeSession(deviceToken: string | null): AppEventUploaderSession {
    return { load: () => (deviceToken ? { deviceToken } : null) };
  }

  function makeClient(
    result: { ok: true } | { ok: false; message: string } = { ok: true },
  ) {
    const postAppEvents = vi.fn().mockResolvedValue({ ...result, data: undefined });
    const client = { postAppEvents } as unknown as AppEventUploaderClient;
    return { client, postAppEvents };
  }

  function makeUploader(
    session: AppEventUploaderSession,
    client: AppEventUploaderClient,
  ) {
    const offlineQueue = new OfflineQueue(store);
    const uploader = new AppEventUploader(session, client, offlineQueue);
    offlineQueue.registerSender(uploader);
    return { uploader, offlineQueue };
  }

  it('enqueues a sample with an app name and uploads it on flush', async () => {
    const { client, postAppEvents } = makeClient();
    const { uploader } = makeUploader(makeSession('token-1'), client);

    uploader.enqueue(makeSample());
    await uploader.flush();

    expect(postAppEvents).toHaveBeenCalledWith('token-1', [
      {
        appName: 'Google Chrome',
        title: 'Gmail',
        titleUnavailableReason: undefined,
        sampledAt: '2026-09-08T12:00:00.000Z',
      },
    ]);
  });

  it('drops a sample with no app name (Wayland) rather than uploading an empty row', async () => {
    const { client, postAppEvents } = makeClient();
    const { uploader } = makeUploader(makeSession('token-1'), client);

    uploader.enqueue(
      makeSample({ appName: null, title: null, titleUnavailableReason: 'not-exposed' }),
    );
    await uploader.flush();

    expect(postAppEvents).not.toHaveBeenCalled();
  });

  it('does nothing on flush when nothing is queued', async () => {
    const { client, postAppEvents } = makeClient();
    const { uploader } = makeUploader(makeSession('token-1'), client);

    await uploader.flush();

    expect(postAppEvents).not.toHaveBeenCalled();
  });

  it('leaves the sample queued (not dropped) when there is no session, and sends it once one exists', async () => {
    vi.useFakeTimers();
    try {
      const { client, postAppEvents } = makeClient();
      const { uploader, offlineQueue } = makeUploader(makeSession(null), client);

      uploader.enqueue(makeSample());
      await uploader.flush();

      expect(postAppEvents).not.toHaveBeenCalled();
      expect(store.countPending('app-event')).toBe(1);

      // Once a session exists AND the retry backoff from the failed
      // attempt above has elapsed, the same queued sample sends without
      // ever being re-enqueued.
      const { client: secondClient, postAppEvents: secondPost } = makeClient();
      const loggedInUploader = new AppEventUploader(
        makeSession('token-1'),
        secondClient,
        offlineQueue,
      );
      offlineQueue.registerSender(loggedInUploader);
      await vi.advanceTimersByTimeAsync(DEFAULT_MAX_RETRY_DELAY_MS);
      await loggedInUploader.flush();

      expect(secondPost).toHaveBeenCalledTimes(1);
      expect(store.countPending('app-event')).toBe(0);
    } finally {
      vi.useRealTimers();
    }
  });

  it('keeps a sample queued for retry after a failed flush, rather than dropping it', async () => {
    const { client, postAppEvents } = makeClient({
      ok: false,
      message: 'network error',
    });
    const { uploader } = makeUploader(makeSession('token-1'), client);

    uploader.enqueue(makeSample());
    await uploader.flush();
    await uploader.flush();

    // Second flush is a no-op — the first failure scheduled a retry that
    // isn't due yet, matching the offline queue's backoff (not dropped,
    // and not hammered immediately either).
    expect(postAppEvents).toHaveBeenCalledTimes(1);
    expect(store.countPending('app-event')).toBe(1);
  });

  it('auto-flushes in batches capped at MAX_BUFFERED_APP_EVENTS per request', async () => {
    const { client, postAppEvents } = makeClient();
    const { uploader } = makeUploader(makeSession('token-1'), client);

    for (let i = 0; i < MAX_BUFFERED_APP_EVENTS + 1; i++) {
      uploader.enqueue(makeSample());
    }
    await uploader.flush();

    expect(postAppEvents).toHaveBeenCalledTimes(2);
    expect((postAppEvents.mock.calls[0] as unknown[])[1]).toHaveLength(
      MAX_BUFFERED_APP_EVENTS,
    );
    expect((postAppEvents.mock.calls[1] as unknown[])[1]).toHaveLength(1);
  });
});

describe('AppEventUploader via the offline queue tick', () => {
  let store: OfflineQueueStore;

  beforeEach(async () => {
    vi.useFakeTimers();
    store = await OfflineQueueStore.create(':memory:');
  });

  afterEach(() => {
    vi.useRealTimers();
    store.close();
  });

  it('flushes queued samples on the queue interval while started', async () => {
    const postAppEvents = vi.fn().mockResolvedValue({ ok: true, data: undefined });
    const client = { postAppEvents } as unknown as AppEventUploaderClient;
    const offlineQueue = new OfflineQueue(store, 1_000, () => 0.5);
    const uploader = new AppEventUploader(
      { load: () => ({ deviceToken: 'token-1' }) },
      client,
      offlineQueue,
    );
    offlineQueue.registerSender(uploader);

    uploader.enqueue({
      appName: 'Slack',
      title: null,
      titleUnavailableReason: null,
      sampledAt: '2026-09-08T12:00:00.000Z',
    });

    offlineQueue.start();
    await vi.advanceTimersByTimeAsync(1_000);

    expect(postAppEvents).toHaveBeenCalledTimes(1);

    offlineQueue.stop();
    uploader.enqueue({
      appName: 'Slack',
      title: null,
      titleUnavailableReason: null,
      sampledAt: '2026-09-08T12:00:05.000Z',
    });
    await vi.advanceTimersByTimeAsync(5_000);

    expect(postAppEvents).toHaveBeenCalledTimes(1);
  });
});
