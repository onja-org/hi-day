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

/** One 10-minute slot of the Screenshots page's "Every 10 min" view. */
export type ScreenshotSlot = {
  /** Half-open [start, end) — the last slot of a DST-shortened day is shorter. */
  start: string;
  end: string;
  /** The project most of the slot's tracked time went to; null when none was. */
  projectId: string | null;
  workedSeconds: number;
  /** 0-100, or null when nothing was measured. Never 0 for "no data". */
  activePercentage: number | null;
  /** How much of the slot an activity sample covers. */
  activityMeasuredSeconds: number;
  /** Every screenshot in the slot, up to the server's cap of 3 — which is
   * also the most the frequency setting can produce in ten minutes. */
  screenshots: ScreenshotSummaryItem[];
  /** Anything beyond that cap, reachable only by a frequency the settings
   * UI doesn't offer. A count, not an expander. */
  extraCount: number;
};

export type ScreenshotSlotHour = {
  start: string;
  workedSeconds: number;
  slots: ScreenshotSlot[];
};

export type ScreenshotSlotsDay = {
  /** This page's hours only — see `totalHours`. */
  hours: ScreenshotSlotHour[];
  /** 1-based; the server serves the last page if asked past the end. */
  page: number;
  pageSize: number;
  /** Hours with tracked time across the whole day. Empty hours are dropped
   * before paging, so no page is ever blank. */
  totalHours: number;
  /** The **whole day's** worked seconds, not this page's. */
  workedSeconds: number;
  /** Weighted by measured time, so a brief slot cannot swing the day. */
  activePercentage: number | null;
  /** Whether activity is recorded for this member at all right now. */
  activityRecorded: boolean;
  /** Whether screenshots are being captured for this member at all right
   * now — lets a slot with tracked time say why it has no image. */
  screenshotsEnabled: boolean;
};

export type GetScreenshotSlotsResult =
  | { ok: true; day: ScreenshotSlotsDay }
  | { ok: false; message: string };
