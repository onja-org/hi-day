import { activeIntervals, mergedLengthMs } from "@/lib/entryIntervals";
import { entrySeconds } from "@/lib/entrySeconds";
import { runningEntrySeconds } from "@/lib/runningEntrySeconds";
import type { TimeEntryListItem } from "@/types/timeEntry";

/**
 * Worked seconds across a set of Time entries, counting time shared by
 * several Devices only once.
 *
 * A person may track on a laptop and a desktop at the same time, each
 * holding its own entry (CONTEXT.md's Worked time, ADR-0022). Adding their
 * `durationSeconds` reports two hours for one hour of work.
 *
 * Rather than recomputing each entry from its timestamps, this keeps the
 * server's `durationSeconds` authoritative — it is the number every other
 * view shows, and it already nets off pauses — and subtracts only the
 * wall-clock genuinely counted twice. Entries that do not overlap therefore
 * total exactly what they always did, to the second.
 *
 * A still-running entry contributes what it has accrued so far, measured
 * against `now`. Omit `now` and only committed time counts — what the weekly
 * matrix wants, and what these totals did before.
 */
export function unionActiveSeconds(
  entries: TimeEntryListItem[],
  now: Date | null = null,
): number {
  const counted = entries.filter(
    (entry) =>
      entry.durationSeconds !== null ||
      runningEntrySeconds(entry, now) !== null,
  );
  if (counted.length === 0) return 0;

  const summed = counted.reduce(
    (total, entry) => total + entrySeconds(entry, now),
    0,
  );
  if (counted.length === 1) return summed;

  const intervals = counted.flatMap((entry) => activeIntervals(entry, now));
  const overlapMs =
    intervals.reduce((total, i) => total + (i.end - i.start), 0) -
    mergedLengthMs(intervals);

  return Math.max(0, summed - Math.round(overlapMs / 1000));
}
