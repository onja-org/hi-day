import type { ScreenshotCapture } from './screenshot-sampler';

export interface ScreenshotUploaderSession {
  load(): { deviceToken: string } | null;
}

export interface ScreenshotUploadUrlResult {
  ok: boolean;
  data?: { uploadUrl: string; storageKey: string };
  message?: string;
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

/**
 * Takes one captured screenshot through the full direct-to-storage flow
 * (see docs/adr/0012-...): request a presigned upload URL, PUT the image
 * bytes straight to Wasabi, then record the resulting storage key as
 * metadata. Unlike `AppEventUploader`, there's no buffering/batching —
 * each capture is its own upload, since screenshots are infrequent
 * (minutes apart, not every 5s) and too large to usefully batch.
 *
 * No offline queue yet (see desktop/README.md's "Known limitations",
 * matching `AppEventUploader`) — a failure at any step just drops that
 * screenshot rather than retrying or persisting it.
 */
export class ScreenshotUploader {
  constructor(
    private readonly authStore: ScreenshotUploaderSession,
    private readonly apiClient: ScreenshotUploaderClient,
  ) {}

  /** The sink handed directly to ScreenshotSampler in main.ts. */
  upload = async (capture: ScreenshotCapture): Promise<void> => {
    const session = this.authStore.load();
    if (!session) return;

    const urlResult = await this.apiClient.requestScreenshotUploadUrl(
      session.deviceToken,
      capture.capturedAt,
    );
    if (!urlResult.ok || !urlResult.data) {
      console.error(
        '[screenshot-upload] could not get an upload URL:',
        urlResult.message,
      );
      return;
    }

    const { uploadUrl, storageKey } = urlResult.data;
    const putOk = await this.apiClient.putScreenshot(uploadUrl, capture.buffer);
    if (!putOk) {
      console.error('[screenshot-upload] upload to storage failed, dropped');
      return;
    }

    const recordResult = await this.apiClient.recordScreenshot(
      session.deviceToken,
      storageKey,
      capture.capturedAt,
    );
    if (!recordResult.ok) {
      console.error(
        '[screenshot-upload] uploaded but could not record metadata:',
        recordResult.message,
      );
    }
  };
}
