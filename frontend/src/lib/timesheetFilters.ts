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

/** The projects present in the entries on screen, named and de-duplicated,
 * so the picker only offers projects that could actually match. */
export function projectOptionsFrom(
  entries: TimeEntryListItem[],
): { id: string; name: string }[] {
  const byId = new Map<string, string>();
  for (const entry of entries) {
    byId.set(entry.projectId, entry.projectName);
  }
  return [...byId.entries()]
    .map(([id, name]) => ({ id, name }))
    .sort((a, b) => a.name.localeCompare(b.name));
}
