import { format } from "date-fns";
import { addDaysToKey, dateKeyInZone, keyAsLocalDate, startOfWeekKey } from "@/lib/timezone";
import { formatReportDay } from "@/lib/formatReportDay";
import type { WeekStart } from "@/types/organisation";
import type { MembershipTeamNames, TimeActivityGrouping } from "@/types/timeActivityGrouping";
import type { TimeEntryListItem } from "@/types/timeEntry";
import { entryProjectName } from "@/lib/entryProjectDisplay";

export type EntryGroup = {
  id: string;
  label: string;
  /** Orders groups: a timestamp for date groupings, the label otherwise. */
  sortKey: string | number;
  entries: TimeEntryListItem[];
};

type GroupDescriptor = Omit<EntryGroup, "entries">;

/** The day an entry started — in `zone` when given (a report reads in the
 * organisation's), otherwise the browser's own. */
function dateKeyOf(entry: TimeEntryListItem, zone?: string): string {
  return zone
    ? dateKeyInZone(entry.startedAt, zone)
    : format(new Date(entry.startedAt), "yyyy-MM-dd");
}

/** "Mon, Sep 28, 2026" — the day an entry started, in `zone` when given. */
export function entryDayLabel(entry: TimeEntryListItem, zone?: string): string {
  return formatReportDay(dateKeyOf(entry, zone));
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
  zone: string | undefined,
): GroupDescriptor[] {
  switch (grouping) {
    case "day": {
      const key = dateKeyOf(entry, zone);
      return [{ id: key, label: formatReportDay(key), sortKey: keyAsLocalDate(key).getTime() }];
    }
    case "week": {
      const start = startOfWeekKey(dateKeyOf(entry, zone), weekStart);
      return [
        {
          id: start,
          label: `${formatReportDay(start)} - ${formatReportDay(addDaysToKey(start, 6))}`,
          sortKey: keyAsLocalDate(start).getTime(),
        },
      ];
    }
    case "project":
      return [byLabel(entry.projectId ?? "", entryProjectName(entry))];
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
  /** The zone days and weeks are read in; the browser's when omitted. */
  zone?: string,
): EntryGroup[] {
  const groups = new Map<string, EntryGroup>();
  for (const entry of entries) {
    for (const described of describeGroups(
      entry,
      grouping,
      teamNames,
      weekStart,
      zone,
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
