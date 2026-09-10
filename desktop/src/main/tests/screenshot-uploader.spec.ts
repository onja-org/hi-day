import { describe, expect, it, vi } from 'vitest';
import type {
  ScreenshotUploaderClient,
  ScreenshotUploaderSession,
} from '../screenshot-uploader';
import { ScreenshotUploader } from '../screenshot-uploader';
import type { ScreenshotCapture } from '../screenshot-sampler';

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
    return { client, requestScreenshotUploadUrl, putScreenshot, recordScreenshot };
  }

  it('takes a capture through the full flow: request URL, PUT bytes, record metadata', async () => {
    const { client, requestScreenshotUploadUrl, putScreenshot, recordScreenshot } =
      makeClient();
    const uploader = new ScreenshotUploader(makeSession('token-1'), client);
    const capture = makeCapture();

    await uploader.upload(capture);

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
  });

  it('does nothing when there is no session', async () => {
    const { client, requestScreenshotUploadUrl } = makeClient();
    const uploader = new ScreenshotUploader(makeSession(null), client);

    await uploader.upload(makeCapture());

    expect(requestScreenshotUploadUrl).not.toHaveBeenCalled();
  });

  it('drops the capture without uploading when requesting the URL fails', async () => {
    const { client, putScreenshot, recordScreenshot } = makeClient({
      requestScreenshotUploadUrl: vi
        .fn()
        .mockResolvedValue({ ok: false, message: 'server error' }),
    });
    const uploader = new ScreenshotUploader(makeSession('token-1'), client);

    await uploader.upload(makeCapture());

    expect(putScreenshot).not.toHaveBeenCalled();
    expect(recordScreenshot).not.toHaveBeenCalled();
  });

  it('does not record metadata when the PUT to storage fails', async () => {
    const { client, recordScreenshot } = makeClient({
      putScreenshot: vi.fn().mockResolvedValue(false),
    });
    const uploader = new ScreenshotUploader(makeSession('token-1'), client);

    await uploader.upload(makeCapture());

    expect(recordScreenshot).not.toHaveBeenCalled();
  });
});
