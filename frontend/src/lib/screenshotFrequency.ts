/** Hubstaff's unit: screenshots per ten minutes, where 0 is "None". */
const PERIOD_SECONDS = 10 * 60;

export const SCREENSHOT_FREQUENCY_OPTIONS: readonly {
  key: string;
  label: string;
}[] = [
  { key: "0", label: "None" },
  { key: "1", label: "1 per 10 minutes" },
  { key: "2", label: "2 per 10 minutes" },
  { key: "3", label: "3 per 10 minutes" },
];

/** Seconds between captures, as a count per ten minutes. `0` is None, and
 * an interval the options don't name rounds to the nearest they do. */
export function perPeriodFromSeconds(seconds: number): string {
  if (seconds <= 0) return "0";
  const count = Math.round(PERIOD_SECONDS / seconds);
  return String(Math.min(3, Math.max(1, count)));
}

/** The inverse. `0` stays 0, meaning no screenshots. */
export function secondsFromPerPeriod(perPeriod: string): number {
  const count = Number(perPeriod);
  return count > 0 ? Math.round(PERIOD_SECONDS / count) : 0;
}
