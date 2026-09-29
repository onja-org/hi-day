import type { TimeEntryListItem, TimeEntrySource } from "@/types/timeEntry";

/**
 * Everything the filter panel narrows a timesheet by, other than the member
 * — that one changes which entries are *fetched*, so it lives in the query
 * rather than here.
 *
 * An empty set means "no restriction on this field" rather than "match
 * nothing"; that's what lets the filters combine without one empty section
 * blanking the page.
 */
export type TimesheetFilters = {
  projectIds: Set<string>;
  sources: Set<TimeEntrySource>;
};

export const EMPTY_TIMESHEET_FILTERS: TimesheetFilters = {
  projectIds: new Set(),
  sources: new Set(),
};

/** Whether anything is narrowed — drives the panel's active-count badge. */
export function countActiveFilters(filters: TimesheetFilters): number {
  return filters.projectIds.size + filters.sources.size;
}

/** Applies every filter at once: an entry has to satisfy all of them. */
export function filterTimeEntries(
  entries: TimeEntryListItem[],
  filters: TimesheetFilters,
): TimeEntryListItem[] {
  return entries.filter(
    (entry) =>
      (filters.projectIds.size === 0 || filters.projectIds.has(entry.projectId)) &&
      (filters.sources.size === 0 || filters.sources.has(entry.source)),
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
