export type UrlSessionGroup = {
  url: string;
  host: string;
  /** From whichever tracked visit to this URL ended most recently. */
  title: string | null;
  /** Summed active (focused) time across every visit to this URL, in ms. */
  totalActiveMs: number;
  lastVisitedAt: string;
  sessionCount: number;
};

export type GetUrlSessionsResult =
  | { ok: true; groups: UrlSessionGroup[] }
  | { ok: false; message: string };

export type DeleteUrlSessionResult =
  | { ok: true }
  | { ok: false; message: string };

export type UrlHourBucketPage = {
  projectId: string | null;
  url: string;
  host: string;
  title: string | null;
  activeMs: number;
  sessionCount: number;
};

export type UrlHourBucket = {
  hourStart: string;
  pages: UrlHourBucketPage[];
};

export type UrlActivityDay = {
  date: string;
  totalActiveMs: number;
  buckets: UrlHourBucket[];
};

export type GetUrlActivityDayResult =
  | { ok: true; day: UrlActivityDay }
  | { ok: false; message: string };
