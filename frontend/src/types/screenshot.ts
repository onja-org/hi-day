export type ScreenshotSummaryItem = {
  id: string;
  capturedAt: string;
  /** Presigned, time-limited GET URL — expires after a while, never a permanent link. */
  url: string;
  /** The covering period's activity level (see docs/adr/0013-...), or `null` if none covers this screenshot. */
  activePercentage: number | null;
  periodStart: string | null;
  periodEnd: string | null;
};

export type GetScreenshotsResult =
  | { ok: true; screenshots: ScreenshotSummaryItem[] }
  | { ok: false; message: string };
