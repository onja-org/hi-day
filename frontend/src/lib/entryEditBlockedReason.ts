import type { TimeEntryListItem } from "@/types/timeEntry";

type Gateable = Pick<TimeEntryListItem, "canEdit" | "endedAt" | "pausedAt">;

// Admins can always edit; for anyone else it's the Modify time setting.
const NO_MODIFY_TIME =
  "You can't change recorded time — ask an admin to turn on Modify time for you.";

/**
 * Why Edit is unavailable on an entry, or undefined when it isn't.
 *
 * A *paused* entry can be edited: nothing is accruing, so its project, task
 * and start are as settled as a finished entry's. Only a live, ticking one
 * is held back — and even then just because its end is still moving, which
 * the form handles by withholding that field.
 */
export function entryEditBlockedReason(entry: Gateable): string | undefined {
  if (!entry.canEdit) {
    return NO_MODIFY_TIME;
  }
  if (entry.endedAt === null && !entry.pausedAt) {
    return "Pause or stop the timer first to edit this entry.";
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
