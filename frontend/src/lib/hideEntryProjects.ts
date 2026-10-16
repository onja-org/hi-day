import type { TimeEntryListItem } from "@/types/timeEntry";

/**
 * Entries as an Organisation with Projects off should see them. Entries that
 * were tracked while Projects were on keep their Project in the database —
 * turning the setting off hides it, never deletes it — so every view reading
 * entries would otherwise have to remember to hide it. Doing it once, where
 * the entries are fetched, means none of them can forget.
 */
export function hideEntryProjects(entries: TimeEntryListItem[]): TimeEntryListItem[] {
  return entries.map((entry) => ({
    ...entry,
    projectId: null,
    projectName: null,
    projectColour: null,
  }));
}
