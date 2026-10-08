import type { AppActivityDay } from "@/types/appActivity";

export type AppSeconds = {
  appName: string;
  seconds: number;
};

/** A day's per-hour app buckets folded into one total per app, busiest first. */
export function sumAppSeconds(day: AppActivityDay): AppSeconds[] {
  const totals = new Map<string, number>();
  for (const bucket of day.buckets) {
    for (const item of bucket.items) {
      totals.set(item.appName, (totals.get(item.appName) ?? 0) + item.secondsSpent);
    }
  }
  return [...totals.entries()]
    .map(([appName, seconds]) => ({ appName, seconds }))
    .sort((a, b) => b.seconds - a.seconds || a.appName.localeCompare(b.appName));
}
