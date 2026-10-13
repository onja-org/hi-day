import { entrySeconds } from "./entrySeconds";
import { addDaysToKey, dateKeyInZone, keyAsLocalDate, localDateToKey } from "./timezone";
import type { TimeEntryListItem } from "@/types/timeEntry";

export type DailyTotal = {
  dateKey: string;
  seconds: number;
};

export type WeeklyBucket = {
  label: string;
  seconds: number;
};

/**
 * Zero-filled per-local-calendar-day totals across `[from, to]` (inclusive),
 * summing only completed entries — same convention as
 * `groupTimeEntriesByDay`, so a chart total and the table's day subtotals
 * never disagree. Never parses `dateKey` back with `new Date(dateKeyString)`
 * — that parses as UTC and can land on the wrong local day.
 */
export function buildDailyTotals(
  entries: TimeEntryListItem[],
  from: Date,
  to: Date,
  elapsedNow: Date | null = null,
  /** The zone the days are cut in; the browser's when omitted. */
  zone?: string,
): DailyTotal[] {
  const keyOf = (at: Date) => (zone ? dateKeyInZone(at, zone) : localDateToKey(at));
  const totals = new Map<string, number>();
  const lastKey = keyOf(to);
  for (let key = keyOf(from); key <= lastKey; key = addDaysToKey(key, 1)) {
    totals.set(key, 0);
  }

  for (const entry of entries) {
    const key = keyOf(new Date(entry.startedAt));
    if (totals.has(key)) {
      totals.set(key, totals.get(key)! + entrySeconds(entry, elapsedNow));
    }
  }

  return [...totals.entries()].map(([dateKey, seconds]) => ({ dateKey, seconds }));
}

const WEEK_CHUNK_SIZE = 7;

/** Chunks day-level totals into consecutive 7-day buckets, labeled by their
 * covered date range — used to keep a month view to a handful of bars
 * instead of ~30 unreadably thin ones. */
export function bucketWeekly(daily: DailyTotal[]): WeeklyBucket[] {
  const buckets: WeeklyBucket[] = [];
  for (let i = 0; i < daily.length; i += WEEK_CHUNK_SIZE) {
    const chunk = daily.slice(i, i + WEEK_CHUNK_SIZE);
    const start = keyAsLocalDate(chunk[0].dateKey);
    const end = keyAsLocalDate(chunk[chunk.length - 1].dateKey);
    const label =
      start.getMonth() === end.getMonth()
        ? `${start.toLocaleDateString([], { month: "short", day: "numeric" })}–${end.getDate()}`
        : `${start.toLocaleDateString([], { month: "short", day: "numeric" })}–${end.toLocaleDateString([], { month: "short", day: "numeric" })}`;
    buckets.push({
      label,
      seconds: chunk.reduce((sum, day) => sum + day.seconds, 0),
    });
  }
  return buckets;
}
