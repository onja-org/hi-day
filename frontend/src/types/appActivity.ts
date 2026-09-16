export type AppHourBucketItem = {
  projectId: string | null;
  appName: string;
  secondsSpent: number;
  sessionCount: number;
};

export type AppHourBucket = {
  hourStart: string;
  items: AppHourBucketItem[];
};

export type AppActivityDay = {
  date: string;
  totalSecondsSpent: number;
  buckets: AppHourBucket[];
};

export type GetAppActivityDayResult =
  | { ok: true; day: AppActivityDay }
  | { ok: false; message: string };
