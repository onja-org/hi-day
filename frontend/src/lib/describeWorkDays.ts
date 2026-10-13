export const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** Monday-first, because a working week reads that way even though
 * `getDay()` counts from Sunday. */
export const DAYS_IN_WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0];

/**
 * "Mon - Fri" for a contiguous run, "Mon, Wed, Fri" otherwise, "-" for
 * none — the summary the settings header and each member row show.
 */
export function describeWorkDays(days: number[]): string {
  if (days.length === 0) return "-";
  const ordered = [...days].sort(
    (a, b) => DAYS_IN_WEEK_ORDER.indexOf(a) - DAYS_IN_WEEK_ORDER.indexOf(b),
  );
  const contiguous = ordered.every(
    (day, index) =>
      index === 0 ||
      DAYS_IN_WEEK_ORDER.indexOf(day) -
        DAYS_IN_WEEK_ORDER.indexOf(ordered[index - 1]) ===
        1,
  );
  return contiguous && ordered.length > 2
    ? `${DAY_LABELS[ordered[0]]} - ${DAY_LABELS[ordered[ordered.length - 1]]}`
    : ordered.map((day) => DAY_LABELS[day]).join(", ");
}
