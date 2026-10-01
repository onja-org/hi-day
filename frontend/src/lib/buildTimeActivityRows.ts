import { entrySeconds } from "@/lib/entrySeconds";
import { formatClockTime } from "@/lib/formatClockTime";
import { formatElapsed } from "@/lib/formatElapsed";
import { describeEntryWhen, groupEntriesBy, memberLabelOf } from "@/lib/groupEntriesBy";
import { splitEntrySeconds } from "@/lib/splitEntrySeconds";
import type { ReportTableRow } from "@/types/reportTable";
import type { TimeActivityGrouping } from "@/types/timeActivityGrouping";
import type { TimeEntryListItem } from "@/types/timeEntry";

function hours(seconds: number): string {
  return formatElapsed(seconds * 1000);
}

function distinct(values: (string | null)[]): string {
  const unique = [...new Set(values.filter((value): value is string => value !== null))];
  return unique.length > 0 ? unique.join(", ") : "-";
}

function timeCells(entries: TimeEntryListItem[]): Record<string, string> {
  const { tracked, manual } = splitEntrySeconds(entries);
  const paused = entries.reduce((sum, entry) => sum + entry.pausedSeconds, 0);
  return {
    regular: hours(tracked),
    manual: hours(manual),
    total: hours(tracked + manual),
    breakTime: hours(paused),
  };
}

function entryCells(entries: TimeEntryListItem[]): Record<string, string> {
  return {
    member: distinct(entries.map(memberLabelOf)),
    project: distinct(entries.map((entry) => entry.projectName)),
    todo: distinct(entries.map((entry) => entry.taskName)),
    ...timeCells(entries),
  };
}

/**
 * One row per group, each expandable into its individual entries. "None"
 * skips grouping: every entry is its own flat row. Under a day group a
 * sub-row only needs the time of day; any other grouping spans days, so
 * its sub-rows carry the date too.
 */
export function buildTimeActivityRows(
  entries: TimeEntryListItem[],
  grouping: TimeActivityGrouping,
): ReportTableRow[] {
  return groupEntriesBy(entries, grouping).map((group) => {
    if (grouping === "none") {
      return {
        id: group.id,
        sortKey: group.sortKey,
        cells: { date: group.label, ...entryCells(group.entries) },
      };
    }
    return {
      id: group.id,
      sortKey: group.sortKey,
      cells: { date: `${group.label} (${group.entries.length})`, ...entryCells(group.entries) },
      subRows: group.entries.map((entry) => ({
        id: entry.id,
        sortKey: new Date(entry.startedAt).getTime(),
        cells: {
          date:
            grouping === "day"
              ? `${formatClockTime(entry.startedAt)} – ${entry.endedAt ? formatClockTime(entry.endedAt) : "now"}`
              : describeEntryWhen(entry),
          ...entryCells([entry]),
        },
      })),
    };
  });
}

/** Total seconds across `entries`, the figure behind the "Total time" tile. */
export function totalEntrySeconds(entries: TimeEntryListItem[]): number {
  return entries.reduce((sum, entry) => sum + entrySeconds(entry, null), 0);
}
