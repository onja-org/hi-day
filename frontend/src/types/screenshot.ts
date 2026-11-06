export type ScreenshotSummaryItem = {
  id: string;
  capturedAt: string;
  /** Presigned, time-limited GET URL — expires after a while, never a permanent link. */
  url: string;
  /** The project whose TimeEntry covered this screenshot's capturedAt —
   * null if no timer was running (the common case). */
  projectId: string | null;
};

/** One page of a day's screenshots, as both list endpoints return it. */
export type ScreenshotsPage = {
  items: ScreenshotSummaryItem[];
  /** Every matching screenshot that day, across all pages. */
  total: number;
  /** The page the server actually served — lower than the one asked for
   * when that ran past the end (e.g. after deleting a last page). */
  page: number;
  pageSize: number;
};

/** Which page of a day's screenshots to ask for, and how big. */
export type ScreenshotsPaging = {
  /** 1-based; defaults to 1. */
  page?: number;
  pageSize?: number;
  /** Newest capture first — for previews of the latest few. */
  newestFirst?: boolean;
};

export type GetScreenshotsPageResult =
  | { ok: true; page: ScreenshotsPage }
  | { ok: false; message: string };
