import { describe, expect, it, vi } from 'vitest';
import type {
  ScreenshotUploaderClient,
  ScreenshotUploaderSession,
} from '../screenshot-uploader';
import { ScreenshotUploader } from '../screenshot-uploader';
import type { ScreenshotCapture } from '../screenshot-sampler';
import { DEFAULT_MAX_RETRY_DELAY_MS, OfflineQueue } from '../offline-queue';
import { OfflineQueueStore } from '../offline-queue-store';

describe('ScreenshotUploader', () => {
  function makeCapture(overrides: Partial<ScreenshotCapture> = {}): ScreenshotCapture {
    return {
      buffer: Buffer.from('fake-jpeg-bytes'),
      capturedAt: '2026-09-08T12:00:00.000Z',
      ...overrides,
    };
  }

  function makeSession(deviceToken: string | null): ScreenshotUploaderSession {
    return { load: () => (deviceToken ? { deviceToken } : null) };
  }

  function makeClient(overrides: Partial<ScreenshotUploaderClient> = {}) {
    const requestScreenshotUploadUrl = vi.fn().mockResolvedValue({
      ok: true,
      data: { uploadUrl: 'https://storage.example/put', storageKey: 'screenshots/org-1/device-1/a.jpg' },
    });
    const putScreenshot = vi.fn().mockResolvedValue(true);
    const recordScreenshot = vi.fn().mockResolvedValue({ ok: true });
    const client = {
      requestScreenshotUploadUrl,
      putScreenshot,
      recordScreenshot,
      ...overrides,
    };
    // These three are the defaults above — a test that overrides one must
    // declare its own local and pass it via `overrides`, then assert
    // against that same local (see the tests below), not this return
    // value, otherwise it'd be asserting on a mock `client` never calls.
    return { client, requestScreenshotUploadUrl, putScreenshot, recordScreenshot };
  }

  async function makeUploader(session: ScreenshotUploaderSession, client: ScreenshotUploaderClient) {
    const store = await OfflineQueueStore.create(':memory:');
    const offlineQueue = new OfflineQueue(store);
    const uploader = new ScreenshotUploader(session, client, offlineQueue);
    offlineQueue.registerSender(uploader);
    return { uploader, offlineQueue, store };
  }

  it('takes a capture through the full flow: request URL, PUT bytes, record metadata', async () => {
    const { client, requestScreenshotUploadUrl, putScreenshot, recordScreenshot } =
      makeClient();
    const { uploader, offlineQueue, store } = await makeUploader(makeSession('token-1'), client);
    const capture = makeCapture();

    uploader.upload(capture);
    // `upload` already fired a `flushOnEnqueue` attempt in the background;
    // `flushKind` attaches to that same in-flight run instead of starting a
    // second one (see OfflineQueue's per-kind concurrency guard), so this
    // reliably waits for it to finish instead of guessing a tick count.
    await offlineQueue.flushKind('screenshot');

    expect(requestScreenshotUploadUrl).toHaveBeenCalledWith(
      'token-1',
      '2026-09-08T12:00:00.000Z',
    );
    expect(putScreenshot).toHaveBeenCalledWith(
      'https://storage.example/put',
      capture.buffer,
    );
    expect(recordScreenshot).toHaveBeenCalledWith(
      'token-1',
      'screenshots/org-1/device-1/a.jpg',
      '2026-09-08T12:00:00.000Z',
    );
    expect(store.countPending('screenshot')).toBe(0);
    store.close();
  });

  it('leaves the capture queued (not dropped) when there is no session', async () => {
    const { client, requestScreenshotUploadUrl } = makeClient();
    const { uploader, offlineQueue, store } = await makeUploader(makeSession(null), client);

    uploader.upload(makeCapture());
    await offlineQueue.flushKind('screenshot');

    expect(requestScreenshotUploadUrl).not.toHaveBeenCalled();
    expect(store.countPending('screenshot')).toBe(1);
    store.close();
  });

  it('discards (does not retry) a capture rejected with 403 on the upload-url request — a permanent rejection, not a transient failure', async () => {
    const { client, putScreenshot, recordScreenshot } = makeClient({
      requestScreenshotUploadUrl: vi
        .fn()
        .mockResolvedValue({ ok: false, status: 403, message: 'forbidden' }),
    });
    const { uploader, offlineQueue, store } = await makeUploader(makeSession('token-1'), client);

    uploader.upload(makeCapture());
    await offlineQueue.flushKind('screenshot');

    expect(putScreenshot).not.toHaveBeenCalled();
    expect(recordScreenshot).not.toHaveBeenCalled();
    expect(store.countPending('screenshot')).toBe(0);
    store.close();
  });

  it('leaves the capture queued for retry when requesting the URL fails', async () => {
    const { client, putScreenshot, recordScreenshot } = makeClient({
      requestScreenshotUploadUrl: vi
        .fn()
        .mockResolvedValue({ ok: false, message: 'server error' }),
    });
    const { uploader, offlineQueue, store } = await makeUploader(makeSession('token-1'), client);

    uploader.upload(makeCapture());
    await offlineQueue.flushKind('screenshot');

    expect(putScreenshot).not.toHaveBeenCalled();
    expect(recordScreenshot).not.toHaveBeenCalled();
    expect(store.countPending('screenshot')).toBe(1);
    store.close();
  });

  it('leaves the capture queued for retry when the PUT to storage fails', async () => {
    const { client, recordScreenshot } = makeClient({
      putScreenshot: vi.fn().mockResolvedValue(false),
    });
    const { uploader, offlineQueue, store } = await makeUploader(makeSession('token-1'), client);

    uploader.upload(makeCapture());
    await offlineQueue.flushKind('screenshot');

    expect(recordScreenshot).not.toHaveBeenCalled();
    expect(store.countPending('screenshot')).toBe(1);
    store.close();
  });

  it('requests a fresh upload URL on retry rather than reusing the expired one', async () => {
    vi.useFakeTimers();
    try {
      const requestScreenshotUploadUrl = vi
        .fn()
        .mockResolvedValueOnce({
          ok: true,
          data: { uploadUrl: 'https://storage.example/put-1', storageKey: 'a.jpg' },
        })
        .mockResolvedValueOnce({
          ok: true,
          data: { uploadUrl: 'https://storage.example/put-2', storageKey: 'b.jpg' },
        });
      const { client, recordScreenshot } = makeClient({
        requestScreenshotUploadUrl,
        putScreenshot: vi.fn().mockResolvedValueOnce(false).mockResolvedValueOnce(true),
      });
      const { uploader, offlineQueue, store } = await makeUploader(makeSession('token-1'), client);

      uploader.upload(makeCapture());
      await offlineQueue.flushKind('screenshot'); // PUT fails, stays queued
      await vi.advanceTimersByTimeAsync(DEFAULT_MAX_RETRY_DELAY_MS); // past the resulting backoff
      await offlineQueue.flushKind('screenshot'); // retry succeeds with a fresh URL

      expect(requestScreenshotUploadUrl).toHaveBeenCalledTimes(2);
      expect(recordScreenshot).toHaveBeenCalledWith('token-1', 'b.jpg', '2026-09-08T12:00:00.000Z');
      expect(store.countPending('screenshot')).toBe(0);
      store.close();
    } finally {
      vi.useRealTimers();
    }
  });

  it('does not retry forever when it fails immediately on enqueue (backoff still applies)', async () => {
    const requestScreenshotUploadUrl = vi.fn().mockResolvedValue({ ok: false, message: 'down' });
    const { client } = makeClient({ requestScreenshotUploadUrl });
    const { uploader, offlineQueue, store } = await makeUploader(makeSession('token-1'), client);

    uploader.upload(makeCapture()); // flushOnEnqueue fires one attempt
    await offlineQueue.flushKind('screenshot'); // attaches to that attempt, then this call would be a second, separate one — but backoff isn't elapsed yet
    await offlineQueue.flushKind('screenshot'); // called again immediately — should be a no-op (backoff not elapsed)

    expect(requestScreenshotUploadUrl).toHaveBeenCalledTimes(1);
    store.close();
  });
});
