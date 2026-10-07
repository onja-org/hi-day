import type { TimeEntryListItem } from "@/types/timeEntry";

type OverlapSearch = {
  /** Entries already on screen — see the caveat on the return value. */
  entries: TimeEntryListItem[];
  /** Whose timesheet the new times land on. */
  membershipId?: string;
  /** The entry being edited, which cannot overlap itself. */
  excludeId?: string;
  /** `datetime-local` values, as the inputs hold them. */
  startedAt: string;
  endedAt: string;
  now?: Date;
};

/**
 * The first already-tracked entry the given times run into, or null.
 *
 * Only ever an early warning, never the verdict: the browser knows the
 * entries currently loaded — one day, one filter, one page — and the person
 * may well be typing times that land outside all of them. The server does
 * the real check on save; this exists so the common mistake is caught while
 * the field still has focus instead of after a round trip.
 */
export function findOverlappingEntry({
  entries,
  membershipId,
  excludeId,
  startedAt,
  endedAt,
  now = new Date(),
}: OverlapSearch): TimeEntryListItem | null {
  const start = new Date(startedAt).getTime();
  const end = new Date(endedAt).getTime();
  if (Number.isNaN(start) || Number.isNaN(end) || end <= start) return null;

  return (
    entries.find((entry) => {
      if (entry.id === excludeId) return false;
      // An admin's timesheet lists several people; only the one these times
      // are being written for can be run into.
      if (membershipId !== undefined && entry.membershipId !== membershipId) {
        return false;
      }

      const entryStart = new Date(entry.startedAt).getTime();
      // A running entry has no end yet but still occupies the time up to
      // now, which is exactly the stretch someone is most likely to
      // double-book.
      const entryEnd =
        entry.endedAt === null ? now.getTime() : new Date(entry.endedAt).getTime();
      if (Number.isNaN(entryStart) || Number.isNaN(entryEnd)) return false;

      // Touching at an endpoint is not overlapping: one entry ending at
      // 10:00 and the next starting at 10:00 is an ordinary handover.
      return start < entryEnd && end > entryStart;
    }) ?? null
  );
}
