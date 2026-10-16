import type { ProjectColour } from "@/types/project";
import type { TimeEntryListItem } from "@/types/timeEntry";

type EntryProject = Pick<TimeEntryListItem, "projectName" | "projectColour">;

/** What a report, export or grouping calls an entry that has no Project. */
export const NO_PROJECT_LABEL = "No project";

/** What a row, calendar block or modal titles an entry that has no Project.
 * Deliberately not "No project": an organisation with Projects off has
 * nothing else, and every row saying so would read as something missing. */
export const UNTITLED_ENTRY_LABEL = "Tracked time";

export function entryTitle(entry: EntryProject): string {
  return entry.projectName ?? UNTITLED_ENTRY_LABEL;
}

export function entryProjectName(entry: EntryProject): string {
  return entry.projectName ?? NO_PROJECT_LABEL;
}

/** Neutral gray, so an entry with no Project still draws like the rest. */
export function entryProjectColour(entry: EntryProject): ProjectColour {
  return entry.projectColour ?? "gray";
}
