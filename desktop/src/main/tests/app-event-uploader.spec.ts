import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AppEventUploaderClient, AppEventUploaderSession } from '../app-event-uploader';
import { AppEventUploader, MAX_BUFFERED_APP_EVENTS } from '../app-event-uploader';
import type { WindowSample } from '../window-sample';

describe('AppEventUploader', () => {
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

  it('enqueues a sample with an app name and uploads it on flush', async () => {
    const { client, postAppEvents } = makeClient();
    const uploader = new AppEventUploader(makeSession('token-1'), client);

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
    const uploader = new AppEventUploader(makeSession('token-1'), client);

    uploader.enqueue(
      makeSample({ appName: null, title: null, titleUnavailableReason: 'not-exposed' }),
    );
    await uploader.flush();

    expect(postAppEvents).not.toHaveBeenCalled();
  });

  it('does nothing on flush when the buffer is empty', async () => {
    const { client, postAppEvents } = makeClient();
    const uploader = new AppEventUploader(makeSession('token-1'), client);

    await uploader.flush();

    expect(postAppEvents).not.toHaveBeenCalled();
  });

  it('drops the buffer without uploading when there is no session', async () => {
    const { client, postAppEvents } = makeClient();
    const uploader = new AppEventUploader(makeSession(null), client);

    uploader.enqueue(makeSample());
    await uploader.flush();

    expect(postAppEvents).not.toHaveBeenCalled();
  });

  it('clears the buffer after a flush, even a failed one', async () => {
    const { client, postAppEvents } = makeClient({
      ok: false,
      message: 'network error',
    });
    const uploader = new AppEventUploader(makeSession('token-1'), client);

    uploader.enqueue(makeSample());
    await uploader.flush();
    await uploader.flush();

    // Second flush has nothing left to send — first flush already drained
    // the buffer, matching "no offline queue" (a failed batch is dropped,
    // not retried).
    expect(postAppEvents).toHaveBeenCalledTimes(1);
  });

  it('auto-flushes once the buffer reaches the max batch size', () => {
    const { client, postAppEvents } = makeClient();
    const uploader = new AppEventUploader(makeSession('token-1'), client);

    for (let i = 0; i < MAX_BUFFERED_APP_EVENTS; i++) {
      uploader.enqueue(makeSample());
    }

    expect(postAppEvents).toHaveBeenCalledTimes(1);
    expect((postAppEvents.mock.calls[0] as unknown[])[1]).toHaveLength(
      MAX_BUFFERED_APP_EVENTS,
    );
  });
});

describe('AppEventUploader start/stop', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('flushes on its own interval while started', async () => {
    const postAppEvents = vi.fn().mockResolvedValue({ ok: true, data: undefined });
    const client = { postAppEvents } as unknown as AppEventUploaderClient;
    const uploader = new AppEventUploader(
      { load: () => ({ deviceToken: 'token-1' }) },
      client,
      1_000,
    );
    uploader.enqueue({
      appName: 'Slack',
      title: null,
      titleUnavailableReason: null,
      sampledAt: '2026-09-08T12:00:00.000Z',
    });

    uploader.start();
    await vi.advanceTimersByTimeAsync(1_000);

    expect(postAppEvents).toHaveBeenCalledTimes(1);

    uploader.stop();
    await vi.advanceTimersByTimeAsync(5_000);

    expect(postAppEvents).toHaveBeenCalledTimes(1);
  });
});
