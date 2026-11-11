import { toDatetimeLocalValue } from "@/lib/toDatetimeLocalValue";

export type TimeRangeParts = {
  /** `YYYY-MM-DD` the entry is logged against. */
  date: string;
  /** `HH:mm` wall-clock times, or "" while still unfilled. */
  startTime: string;
  endTime: string;
};

export type TimeRange = {
  /** `YYYY-MM-DDTHH:mm`, or "" when a part it needs is missing. */
  startedAt: string;
  endedAt: string;
  /** The end is no later in the day than the start, so it falls on the day
   * after the chosen date — a shift worked across midnight. */
  endsNextDay: boolean;
};

/** Compared as `YYYY-MM-DD`, so UTC arithmetic keeps DST out of it. */
function dayAfter(date: string): string {
  const next = new Date(`${date}T00:00:00Z`);
  next.setUTCDate(next.getUTCDate() + 1);
  return next.toISOString().slice(0, 10);
}

/**
 * The two instants one date and two times of day stand for.
 *
 * The form asks for a single date, as Hubstaff's does, so an end earlier
 * than its start is read as the next morning rather than refused — that's
 * what an overnight shift looks like, and it keeps such an entry editable.
 */
export function timeRangeFromParts({
  date,
  startTime,
  endTime,
}: TimeRangeParts): TimeRange {
  const startedAt = date && startTime ? `${date}T${startTime}` : "";
  if (!date || !endTime) {
    return { startedAt, endedAt: "", endsNextDay: false };
  }

  const endsNextDay = startTime !== "" && endTime <= startTime;
  return {
    startedAt,
    endedAt: `${endsNextDay ? dayAfter(date) : date}T${endTime}`,
    endsNextDay,
  };
}

/** The same shape read back off an entry, for the form's starting values.
 * The date is the start's — an overnight end then re-derives itself. */
export function timeRangeToParts(
  startedAt?: string,
  endedAt?: string | null,
): TimeRangeParts {
  const start = startedAt ? toDatetimeLocalValue(startedAt) : "";
  const end = endedAt ? toDatetimeLocalValue(endedAt) : "";

  return {
    date: start.slice(0, 10),
    startTime: start.slice(11, 16),
    endTime: end.slice(11, 16),
  };
}
