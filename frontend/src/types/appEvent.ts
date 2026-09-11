export type AppTimeSummaryItem = {
  appName: string;
  secondsSpent: number;
};

export type AppTimeSummary = {
  date: string;
  totalSecondsSpent: number;
  items: AppTimeSummaryItem[];
};

export type GetAppTimeSummaryResult =
  | { ok: true; summary: AppTimeSummary }
  | { ok: false; message: string };
