import type { PauseSpan, TimeEntryListItem } from "@/types/timeEntry";

/** Half-open [start, end) in epoch milliseconds. */
export type Interval = { start: number; end: number };

/**
 * One entry's span, less every pause carved out of it.
 *
 * An unstopped entry runs to `now`, or to the instant it was paused — the
 * same `pausedAt ?? now` rule `runningEntrySeconds` measures by, so an
 * interval and the seconds it contributes cannot disagree.
 */
export function activeIntervals(
  entry: TimeEntryListItem,
  now: Date | null,
): Interval[] {
  const start = Date.parse(entry.startedAt);
  const unstoppedEnd = entry.pausedAt
    ? Date.parse(entry.pausedAt)
    : (now?.getTime() ?? start);
  const end = entry.endedAt ? Date.parse(entry.endedAt) : unstoppedEnd;
  let remaining: Interval[] = [{ start, end }];

  for (const pause of entry.pauses ?? []) {
    const hole = pauseInterval(pause, end);
    remaining = remaining.flatMap((interval) => subtract(interval, hole));
  }

  return remaining.filter((interval) => interval.end > interval.start);
}

/** Total milliseconds covered by these intervals, overlaps counted once. */
export function mergedLengthMs(intervals: Interval[]): number {
  return mergeIntervals(intervals).reduce(
    (sum, interval) => sum + (interval.end - interval.start),
    0,
  );
}

/** Overlapping and touching intervals collapsed into the spans they cover. */
export function mergeIntervals(intervals: Interval[]): Interval[] {
  if (intervals.length === 0) return [];

  const sorted = [...intervals].sort((a, b) => a.start - b.start);
  const merged: Interval[] = [{ ...sorted[0] }];

  for (const interval of sorted.slice(1)) {
    const last = merged[merged.length - 1];
    // Touching counts as continuous: 09:00-10:00 then 10:00-11:00 is two
    // unbroken hours, not two abutting ones with a zero-length seam.
    if (interval.start <= last.end) {
      last.end = Math.max(last.end, interval.end);
    } else {
      merged.push({ ...interval });
    }
  }

  return merged;
}

/**
 * An open pause runs to the entry's end: it never resumed.
 *
 * Never backwards. A span that resumes before it was paused — rows exist,
 * see the backend's `closeOpenPause` — would otherwise carve two
 * overlapping pieces out of the entry and make it total more than its own
 * span. Collapsed to nothing instead, so it removes no time at all.
 */
function pauseInterval(pause: PauseSpan, entryEnd: number): Interval {
  const start = Date.parse(pause.pausedAt);
  const end = pause.resumedAt ? Date.parse(pause.resumedAt) : entryEnd;
  return { start, end: Math.max(start, end) };
}

function subtract(from: Interval, hole: Interval): Interval[] {
  if (hole.end <= from.start || hole.start >= from.end) return [from];

  const parts: Interval[] = [];
  if (hole.start > from.start) parts.push({ start: from.start, end: hole.start });
  if (hole.end < from.end) parts.push({ start: hole.end, end: from.end });
  return parts;
}
