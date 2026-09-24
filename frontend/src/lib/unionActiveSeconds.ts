import type { PauseSpan, TimeEntryListItem } from "@/types/timeEntry";

/** Half-open [start, end) in epoch milliseconds. */
type Interval = { start: number; end: number };

/**
 * Worked seconds across a set of Time entries, counting time shared by
 * several Devices only once.
 *
 * A person may track on a laptop and a desktop at the same time, each
 * holding its own entry (CONTEXT.md's Worked time, ADR-0021). Adding their
 * `durationSeconds` reports two hours for one hour of work.
 *
 * Rather than recomputing each entry from its timestamps, this keeps the
 * server's `durationSeconds` authoritative — it is the number every other
 * view shows, and it already nets off pauses — and subtracts only the
 * wall-clock genuinely counted twice. Entries that do not overlap therefore
 * total exactly what they always did, to the second.
 *
 * Still-running entries (`durationSeconds === null`) are excluded, matching
 * the long-standing behaviour of these totals: time not yet committed is not
 * reported.
 */
export function unionActiveSeconds(entries: TimeEntryListItem[]): number {
  const completed = entries.filter((entry) => entry.durationSeconds !== null);
  if (completed.length === 0) return 0;

  const summed = completed.reduce(
    (total, entry) => total + (entry.durationSeconds ?? 0),
    0,
  );
  if (completed.length === 1) return summed;

  const intervals = completed.flatMap(activeIntervals);
  const overlapMs =
    intervals.reduce((total, i) => total + (i.end - i.start), 0) -
    mergedLengthMs(intervals);

  return Math.max(0, summed - Math.round(overlapMs / 1000));
}

/** Total milliseconds covered by these intervals, overlaps counted once. */
function mergedLengthMs(intervals: Interval[]): number {
  if (intervals.length === 0) return 0;

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

  return merged.reduce((sum, i) => sum + (i.end - i.start), 0);
}

/** One entry's span, less every pause carved out of it. */
function activeIntervals(entry: TimeEntryListItem): Interval[] {
  const start = Date.parse(entry.startedAt);
  const end = entry.endedAt ? Date.parse(entry.endedAt) : start;
  let remaining: Interval[] = [{ start, end }];

  for (const pause of entry.pauses ?? []) {
    const hole = pauseInterval(pause, end);
    remaining = remaining.flatMap((interval) => subtract(interval, hole));
  }

  return remaining.filter((interval) => interval.end > interval.start);
}

/** An open pause runs to the entry's end: it never resumed. */
function pauseInterval(pause: PauseSpan, entryEnd: number): Interval {
  return {
    start: Date.parse(pause.pausedAt),
    end: pause.resumedAt ? Date.parse(pause.resumedAt) : entryEnd,
  };
}

function subtract(from: Interval, hole: Interval): Interval[] {
  if (hole.end <= from.start || hole.start >= from.end) return [from];

  const parts: Interval[] = [];
  if (hole.start > from.start) parts.push({ start: from.start, end: hole.start });
  if (hole.end < from.end) parts.push({ start: hole.end, end: from.end });
  return parts;
}
