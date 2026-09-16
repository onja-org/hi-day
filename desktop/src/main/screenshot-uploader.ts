import type { OfflineQueue, QueuedItem, QueueSender } from './offline-queue';
import type { ScreenshotCapture } from './screenshot-sampler';

export const SCREENSHOT_QUEUE_KIND = 'screenshot';
/**
 * Safety valve against unbounded local disk growth during a very long
 * offline stretch — at the default 10-minute capture frequency this is
 * roughly 3.5 days of screenshots before the oldest get dropped in favour
 * of the newest.
 */
export const MAX_QUEUED_SCREENSHOTS = 500;

export interface ScreenshotUploaderSession {
  load(): { deviceToken: string } | null;
}

export interface ScreenshotUploadUrlResult {
  ok: boolean;
  data?: { uploadUrl: string; storageKey: string };
  message?: string;
  /** See TrackingResult's own field — lets `send` tell a permanent rejection (403) apart from a transient failure. */
  status?: number;
}

export interface ScreenshotRecordResult {
  ok: boolean;
  message?: string;
}

export interface ScreenshotUploaderClient {
  requestScreenshotUploadUrl(
    deviceToken: string,
    capturedAt: string,
  ): Promise<ScreenshotUploadUrlResult>;
  /** A raw PUT of the image bytes straight to Wasabi — not a `/device/...` call, so it takes the presigned URL directly rather than a device token. */
  putScreenshot(uploadUrl: string, buffer: Buffer): Promise<boolean>;
  recordScreenshot(
    deviceToken: string,
    storageKey: string,
    capturedAt: string,
  ): Promise<ScreenshotRecordResult>;
}

/** The queued payload's JSON side — the image bytes themselves live in the queue row's `blob` column instead (see OfflineQueueStore). */
export interface ScreenshotQueuePayload {
  capturedAt: string;
}

/**
 * Persists each captured screenshot to the offline queue (image bytes and
 * all — see `OfflineQueue`/`OfflineQueueStore`) and, on each queue tick,
 * takes it through the full direct-to-storage flow (see docs/adr/0012-...):
 * request a presigned upload URL, PUT the image bytes straight to Wasabi,
 * then record the resulting storage key as metadata. Unlike
 * `AppEventUploader`, batches of more than one screenshot are never sent
 * together — each capture needs its own presigned URL and PUT, and
 * screenshots are infrequent (minutes apart) and too large to usefully
 * batch — so `maxBatchSize` is 1 and `send` always handles a single item.
 *
 * `flushOnEnqueue` keeps the old "uploads shortly after capture" feel while
 * online (rather than waiting for the shared queue tick); offline, that
 * immediate attempt just fails and the capture stays queued for the
 * queue's own retry/backoff to pick up later.
 */
export class ScreenshotUploader implements QueueSender<ScreenshotQueuePayload> {
  readonly kind = SCREENSHOT_QUEUE_KIND;
  readonly maxBatchSize = 1;
  readonly maxQueuedItems = MAX_QUEUED_SCREENSHOTS;
  readonly flushOnEnqueue = true;

  constructor(
    private readonly authStore: ScreenshotUploaderSession,
    private readonly apiClient: ScreenshotUploaderClient,
    private readonly offlineQueue: OfflineQueue,
  ) {}

  /** The sink handed directly to ScreenshotSampler in main.ts. */
  upload = (capture: ScreenshotCapture): void => {
    this.offlineQueue.enqueue(
      this.kind,
      { capturedAt: capture.capturedAt } satisfies ScreenshotQueuePayload,
      capture.buffer,
    );
  };

  async send(items: QueuedItem<ScreenshotQueuePayload>[]): Promise<boolean> {
    const [item] = items; // maxBatchSize is 1
    if (!item) return true;

    const session = this.authStore.load();
    if (!session) return false;

    if (!item.blob) {
      // Shouldn't happen — `upload` always enqueues the capture's buffer
      // alongside it — but a row with no image can never succeed, so drop
      // it rather than retrying forever.
      console.error('[screenshot-upload] queued item has no image bytes, dropping');
      return true;
    }

    const urlResult = await this.apiClient.requestScreenshotUploadUrl(
      session.deviceToken,
      item.payload.capturedAt,
    );
    if (urlResult.status === 403) {
      // A permanent rejection, not a transient failure like a network blip
      // — retrying would fail forever, and the image bytes would sit in
      // local SQLite indefinitely. Discard instead.
      console.warn('[screenshot-upload] rejected with 403, discarding');
      return true;
    }
    if (!urlResult.ok || !urlResult.data) {
      console.error(
        '[screenshot-upload] could not get an upload URL, will retry:',
        urlResult.message,
      );
      return false;
    }

    const { uploadUrl, storageKey } = urlResult.data;
    const putOk = await this.apiClient.putScreenshot(uploadUrl, item.blob);
    if (!putOk) {
      // A retry re-requests a fresh upload URL from scratch (this one may
      // have expired) rather than reusing `uploadUrl`.
      console.error('[screenshot-upload] upload to storage failed, will retry');
      return false;
    }

    const recordResult = await this.apiClient.recordScreenshot(
      session.deviceToken,
      storageKey,
      item.payload.capturedAt,
    );
    if (!recordResult.ok) {
      console.error(
        '[screenshot-upload] uploaded but could not record metadata, will retry:',
        recordResult.message,
      );
      return false;
    }

    return true;
  }
}
