import type { TimeEntryListItem } from "@/types/timeEntry";

type Gateable = Pick<TimeEntryListItem, "canEdit" | "endedAt" | "pausedAt">;

// Admins can always edit; for anyone else it's the Modify time setting.
const NO_MODIFY_TIME =
  "You can't change recorded time — ask an admin to turn on Modify time for you.";

/**
 * Why Edit is unavailable on an entry, or undefined when it isn't.
 *
 * Running and paused entries can be edited too: their start, project and
 * task can be corrected while the timer keeps going. Only the end is held
 * back on a ticking one, which the form handles by withholding that field —
 * Stop is still how a running entry ends.
 */
export function entryEditBlockedReason(entry: Gateable): string | undefined {
  if (!entry.canEdit) {
    return NO_MODIFY_TIME;
  }
  return undefined;
}

/**
 * Why Split is unavailable, or undefined when it isn't. Stricter than
 * editing: cutting a span in two needs both ends, and a paused entry has no
 * end yet any more than a running one does.
 */
export function entrySplitBlockedReason(entry: Gateable): string | undefined {
  if (!entry.canEdit) {
    return NO_MODIFY_TIME;
  }
  if (entry.endedAt === null) {
    return "Stop the timer first to split this entry.";
  }
  return undefined;
}
