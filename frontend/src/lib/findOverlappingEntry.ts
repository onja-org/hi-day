import type { TimeEntryListItem } from "@/types/timeEntry";

type OverlapSearch = {
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
 * An early warning only: the browser knows the entries currently loaded, so
 * the server still does the real check on save.
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
      if (membershipId !== undefined && entry.membershipId !== membershipId) {
        return false;
      }

      const entryStart = new Date(entry.startedAt).getTime();
      // A running entry still occupies the time up to now.
      const entryEnd =
        entry.endedAt === null ? now.getTime() : new Date(entry.endedAt).getTime();
      if (Number.isNaN(entryStart) || Number.isNaN(entryEnd)) return false;

      // Touching at an endpoint is a handover, not an overlap.
      return start < entryEnd && end > entryStart;
    }) ?? null
  );
}
