import { endOfWeek, format, startOfWeek } from "date-fns";
import { keyAsLocalDate } from "@/lib/timezone";
import { formatReportDay } from "@/lib/formatReportDay";
import { weekStartsOnIndex } from "@/lib/weekStartsOnIndex";
import type { WeekStart } from "@/types/organisation";
import type { MembershipTeamNames, TimeActivityGrouping } from "@/types/timeActivityGrouping";
import type { TimeEntryListItem } from "@/types/timeEntry";

export type EntryGroup = {
  id: string;
  label: string;
  /** Orders groups: a timestamp for date groupings, the label otherwise. */
  sortKey: string | number;
  entries: TimeEntryListItem[];
};

type GroupDescriptor = Omit<EntryGroup, "entries">;

function dateKeyOf(entry: TimeEntryListItem): string {
  return format(new Date(entry.startedAt), "yyyy-MM-dd");
}

/** "Mon, Sep 28, 2026" — the local day an entry started. */
export function entryDayLabel(entry: TimeEntryListItem): string {
  return formatReportDay(dateKeyOf(entry));
}

export function memberLabelOf(entry: TimeEntryListItem): string {
  return entry.memberName ?? entry.memberEmail ?? "-";
}

function byLabel(id: string, label: string): GroupDescriptor {
  return { id, label, sortKey: label };
}

/** Every group an entry belongs to — more than one only for "team", where a member on several teams counts in each. */
function describeGroups(
  entry: TimeEntryListItem,
  grouping: TimeActivityGrouping,
  teamNames: MembershipTeamNames,
  weekStart: WeekStart,
): GroupDescriptor[] {
  switch (grouping) {
    case "day": {
      const key = dateKeyOf(entry);
      return [{ id: key, label: formatReportDay(key), sortKey: keyAsLocalDate(key).getTime() }];
    }
    case "week": {
      const weekOptions = { weekStartsOn: weekStartsOnIndex(weekStart) };
      const start = startOfWeek(new Date(entry.startedAt), weekOptions);
      const end = endOfWeek(start, weekOptions);
      return [
        {
          id: format(start, "yyyy-MM-dd"),
          label: `${formatReportDay(format(start, "yyyy-MM-dd"))} - ${formatReportDay(format(end, "yyyy-MM-dd"))}`,
          sortKey: start.getTime(),
        },
      ];
    }
    case "project":
      return [byLabel(entry.projectId, entry.projectName)];
    case "member":
      return [byLabel(entry.membershipId, memberLabelOf(entry))];
    case "team": {
      const names = teamNames.get(entry.membershipId) ?? [];
      return (names.length > 0 ? names : ["No team"]).map((name) => byLabel(name, name));
    }
    case "none":
      return [
        { id: entry.id, label: memberLabelOf(entry), sortKey: new Date(entry.startedAt).getTime() },
      ];
  }
}

/** Buckets entries by `grouping` (each entry alone for "none"), oldest/alphabetical first. */
export function groupEntriesBy(
  entries: TimeEntryListItem[],
  grouping: TimeActivityGrouping,
  teamNames: MembershipTeamNames = new Map(),
  weekStart: WeekStart = "monday",
): EntryGroup[] {
  const groups = new Map<string, EntryGroup>();
  for (const entry of entries) {
    for (const described of describeGroups(
      entry,
      grouping,
      teamNames,
      weekStart,
    )) {
      const existing = groups.get(described.id);
      if (existing) existing.entries.push(entry);
      else groups.set(described.id, { ...described, entries: [entry] });
    }
  }
  return [...groups.values()].sort((a, b) =>
    typeof a.sortKey === "number" && typeof b.sortKey === "number"
      ? a.sortKey - b.sortKey
      : String(a.sortKey).localeCompare(String(b.sortKey)),
  );
}
