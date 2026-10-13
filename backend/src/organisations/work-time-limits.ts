/**
 * What an Organisation expects of a member's week, and the ceilings on
 * what they may track. Expected hours are a *target* — reports compare
 * against them, nothing blocks on them. Only the two limits cap tracking.
 */
export interface WorkTimeLimits {
  /** ISO-ish day numbers, 0 = Sunday, matching `Date.getDay()`. */
  expectedWorkDays: number[];
  /** Days tracking is refused on. Empty unless the admin opted in. */
  trackingDisabledDays: number[];
  /** Target hours per week; `null` once an admin removes it. */
  expectedWeeklyHours: number | null;
  /** Ceilings on tracked time; `null` is "no limit". */
  weeklyLimitHours: number | null;
  dailyLimitHours: number | null;
}

/** Monday to Friday, the working week the product assumes until told otherwise. */
export const DEFAULT_EXPECTED_WORK_DAYS = [1, 2, 3, 4, 5];

export const DEFAULT_WORK_TIME_LIMITS: WorkTimeLimits = {
  expectedWorkDays: DEFAULT_EXPECTED_WORK_DAYS,
  trackingDisabledDays: [],
  expectedWeeklyHours: null,
  weeklyLimitHours: null,
  dailyLimitHours: null,
};

export const DAY_LABELS = [
  'Sun',
  'Mon',
  'Tue',
  'Wed',
  'Thu',
  'Fri',
  'Sat',
] as const;

/**
 * "Mon - Fri" for a contiguous run, "Mon, Wed, Fri" otherwise, "-" for
 * none — the summary both the settings header and each member row show.
 */
export function describeDays(days: number[]): string {
  if (days.length === 0) return '-';
  // Sorted from Monday, since a working week reads Mon-first even though
  // `getDay()` counts from Sunday.
  const ordered = [...days].sort((a, b) => ((a + 6) % 7) - ((b + 6) % 7));
  const contiguous = ordered.every(
    (day, index) =>
      index === 0 || ((day + 6) % 7) - ((ordered[index - 1] + 6) % 7) === 1,
  );
  if (contiguous && ordered.length > 2) {
    return `${DAY_LABELS[ordered[0]]} - ${DAY_LABELS[ordered[ordered.length - 1]]}`;
  }
  return ordered.map((day) => DAY_LABELS[day]).join(', ');
}
