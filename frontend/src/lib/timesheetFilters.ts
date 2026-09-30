import type {
  TimeEntryListItem,
  TimeEntrySource,
  TimeEntryType,
} from "@/types/timeEntry";

/**
 * Everything the filter panel narrows a timesheet by, other than the member
 * — that one changes which entries are *fetched*, so it lives in the query
 * rather than here.
 *
 * An empty list (or a null threshold) means "no restriction" rather than
 * "match nothing" — that's what lets the filters combine without an
 * untouched section blanking the page. Within a section the values are
 * OR-ed; across sections they are AND-ed.
 */
export type TimesheetFilters = {
  projectIds: string[];
  sources: TimeEntrySource[];
  timeTypes: TimeEntryType[];
  /**
   * Keep entries whose activity is strictly above this percentage. Single,
   * unlike the rest: thresholds nest, so picking "> 90%" and "> 60%" would
   * only ever mean "> 60%".
   */
  minActivePercentage: number | null;
};

export const EMPTY_TIMESHEET_FILTERS: TimesheetFilters = {
  projectIds: [],
  sources: [],
  timeTypes: [],
  minActivePercentage: null,
};

/** The thresholds the panel offers, highest first. */
export const ACTIVITY_LEVEL_THRESHOLDS = [95, 90, 80, 70, 60, 50, 40, 30, 20, 10];

/** How many choices are narrowing — drives the button's badge. */
export function countActiveFilters(filters: TimesheetFilters): number {
  return (
    filters.projectIds.length +
    filters.sources.length +
    filters.timeTypes.length +
    (filters.minActivePercentage === null ? 0 : 1)
  );
}

/**
 * An entry with no activity measurement is excluded by an activity filter
 * rather than kept: asking for "> 60%" and being shown entries whose
 * activity is unknown would misrepresent them as meeting the bar.
 */
function matchesActivity(
  entry: TimeEntryListItem,
  minimum: number | null,
): boolean {
  if (minimum === null) return true;
  return entry.activePercentage !== null && entry.activePercentage > minimum;
}

/** Applies every filter at once: an entry has to satisfy all of them. */
export function filterTimeEntries(
  entries: TimeEntryListItem[],
  filters: TimesheetFilters,
): TimeEntryListItem[] {
  return entries.filter(
    (entry) =>
      (filters.projectIds.length === 0 ||
        filters.projectIds.includes(entry.projectId)) &&
      (filters.sources.length === 0 || filters.sources.includes(entry.source)) &&
      (filters.timeTypes.length === 0 || filters.timeTypes.includes(entry.type)) &&
      matchesActivity(entry, filters.minActivePercentage),
  );
}

/**
 * What the project filter offers: every project the viewer may log time
 * against, plus any project already present in the entries on screen.
 *
 * The second half matters for history. `my-projects` excludes archived
 * projects — right for starting a timer, wrong for a filter over past time,
 * since a project archived last month still has entries in the timesheet.
 * Unioning what's on screen means the filter can always reach what you are
 * looking at, without listing archived projects you can do nothing with.
 */
export function projectFilterOptions(
  assigned: { id: string; name: string }[],
  entries: TimeEntryListItem[],
): { id: string; name: string }[] {
  const byId = new Map<string, string>();
  for (const project of assigned) {
    byId.set(project.id, project.name);
  }
  for (const entry of entries) {
    // Only when absent: the assigned list is the authoritative name, and an
    // entry's copy could be stale after a rename.
    if (!byId.has(entry.projectId)) {
      byId.set(entry.projectId, entry.projectName);
    }
  }
  return [...byId.entries()]
    .map(([id, name]) => ({ id, name }))
    .sort((a, b) => a.name.localeCompare(b.name));
}
