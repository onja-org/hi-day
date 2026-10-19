import type { TimeEntryListItem } from "@/types/timeEntry";

/**
 * What the Time and activity report's filter drawer narrows by. An empty
 * list means "no restriction", so every filter is optional and an untouched
 * one never blanks the report. Within a list the values are OR-ed; across
 * lists they are AND-ed — and with the page's date range, which already
 * decided which entries were fetched.
 */
export type ReportFilters = {
  memberIds: string[];
  teamIds: string[];
  projectIds: string[];
};

export const EMPTY_REPORT_FILTERS: ReportFilters = {
  memberIds: [],
  teamIds: [],
  projectIds: [],
};

/** How many choices are narrowing — drives the Filter button's badge. */
export function countReportFilters(filters: ReportFilters): number {
  return filters.memberIds.length + filters.teamIds.length + filters.projectIds.length;
}

/** Entries from the chosen members, on the chosen teams (via their member), and in the chosen projects. */
export function filterReportEntries(
  entries: TimeEntryListItem[],
  filters: ReportFilters,
  teamIdsByMember: Map<string, string[]>,
): TimeEntryListItem[] {
  return entries.filter(
    (entry) =>
      (filters.memberIds.length === 0 || filters.memberIds.includes(entry.membershipId)) &&
      (filters.teamIds.length === 0 ||
        (teamIdsByMember.get(entry.membershipId) ?? []).some((teamId) =>
          filters.teamIds.includes(teamId),
        )) &&
      (filters.projectIds.length === 0 ||
        (entry.projectId !== null && filters.projectIds.includes(entry.projectId))),
  );
}

/** The members the filters leave in: the chosen ones, on the chosen teams. */
export function filterReportMembers<T extends { id: string }>(
  members: T[],
  filters: ReportFilters,
  teamIdsByMember: Map<string, string[]>,
): T[] {
  return members.filter(
    (member) =>
      (filters.memberIds.length === 0 || filters.memberIds.includes(member.id)) &&
      (filters.teamIds.length === 0 ||
        (teamIdsByMember.get(member.id) ?? []).some((teamId) => filters.teamIds.includes(teamId))),
  );
}
