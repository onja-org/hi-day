export type ScreenshotSummaryItem = {
  id: string;
  capturedAt: string;
  /** Presigned, time-limited GET URL — expires after a while, never a permanent link. */
  url: string;
};

export type GetScreenshotsResult =
  | { ok: true; screenshots: ScreenshotSummaryItem[] }
  | { ok: false; message: string };
