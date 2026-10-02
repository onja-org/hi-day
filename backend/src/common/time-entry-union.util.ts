import { TimeEntry } from '../database/entities/time-entry.entity';
import { TimeEntryPause } from '../database/entities/time-entry-pause.entity';

/** Half-open [start, end) in epoch milliseconds. */
export interface Interval {
  start: number;
  end: number;
}

/**
 * The stretches during which one Time entry was actually tracking: its span,
 * less every pause span carved out of it.
 *
 * `computeActiveSeconds` already nets pauses off a single entry, but it
 * returns a *total*. Merging two Devices' time needs the shape of each
 * entry, not its length — an hour on one Device and an hour on another are
 * one hour or two depending entirely on whether they overlap.
 */
export function activeIntervals(
  entry: TimeEntry,
  pauses: TimeEntryPause[],
  now: Date,
): Interval[] {
  const end = (entry.endedAt ?? now).getTime();
  let remaining: Interval[] = [{ start: entry.startedAt.getTime(), end }];

  for (const pause of pauses) {
    // An open pause runs to the entry's end: it never resumed.
    const pauseStart = pause.pausedAt.getTime();
    const pauseEnd = (pause.resumedAt ?? entry.endedAt ?? now).getTime();
    remaining = remaining.flatMap((interval) =>
      subtract(interval, { start: pauseStart, end: pauseEnd }),
    );
  }

  return remaining.filter((interval) => interval.end > interval.start);
}

function subtract(from: Interval, hole: Interval): Interval[] {
  if (hole.end <= from.start || hole.start >= from.end) return [from];

  const parts: Interval[] = [];
  if (hole.start > from.start)
    parts.push({ start: from.start, end: hole.start });
  if (hole.end < from.end) parts.push({ start: hole.end, end: from.end });
  return parts;
}

/**
 * Merges overlapping intervals, so wall-clock time shared by several
 * Devices counts once.
 *
 * This is what keeps a person's hours bounded by elapsed time now that a
 * Membership may have a timer running on more than one Device: two Devices
 * tracking 09:00–10:00 is one hour worked, not two. See docs/adr/0022.
 */
export function mergeIntervals(intervals: Interval[]): Interval[] {
  if (intervals.length === 0) return [];

  const sorted = [...intervals].sort((a, b) => a.start - b.start);
  const merged: Interval[] = [{ ...sorted[0] }];

  for (const interval of sorted.slice(1)) {
    const last = merged[merged.length - 1];
    // Touching counts as overlapping: 09:00–10:00 and 10:00–11:00 is two
    // unbroken hours, and splitting them would only invite rounding drift.
    if (interval.start <= last.end) {
      last.end = Math.max(last.end, interval.end);
    } else {
      merged.push({ ...interval });
    }
  }

  return merged;
}

/** Seconds covered by the union of these intervals, counting shared time once. */
export function unionSeconds(intervals: Interval[]): number {
  const total = mergeIntervals(intervals).reduce(
    (sum, interval) => sum + (interval.end - interval.start),
    0,
  );
  return Math.max(0, Math.round(total / 1000));
}

/**
 * A Membership's worked seconds across however many Devices it was tracking
 * on — the number that must stay bounded by wall clock.
 */
export function unionActiveSeconds(
  entries: TimeEntry[],
  pausesByEntry: Map<string, TimeEntryPause[]>,
  now: Date,
): number {
  return unionSeconds(
    entries.flatMap((entry) =>
      activeIntervals(entry, pausesByEntry.get(entry.id) ?? [], now),
    ),
  );
}

/** Groups raw pause rows by entry, the shape `unionActiveSeconds` expects. */
export function groupPausesByEntry(
  pauses: TimeEntryPause[],
): Map<string, TimeEntryPause[]> {
  const byEntry = new Map<string, TimeEntryPause[]>();
  for (const pause of pauses) {
    byEntry.set(pause.timeEntryId, [
      ...(byEntry.get(pause.timeEntryId) ?? []),
      pause,
    ]);
  }
  return byEntry;
}
