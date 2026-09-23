export type ScreenshotSummaryItem = {
  id: string;
  capturedAt: string;
  /** Presigned, time-limited GET URL — expires after a while, never a permanent link. */
  url: string;
  /** The project whose TimeEntry covered this screenshot's capturedAt —
   * null if no timer was running (the common case). */
  projectId: string | null;
};

export type GetScreenshotsResult =
  | { ok: true; screenshots: ScreenshotSummaryItem[] }
  | { ok: false; message: string };
