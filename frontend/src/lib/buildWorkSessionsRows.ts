import { entrySeconds } from "@/lib/entrySeconds";
import { formatElapsed } from "@/lib/formatElapsed";
import { entryDayLabel, groupEntriesBy, memberLabelOf } from "@/lib/groupEntriesBy";
import { formatTimeInZone } from "@/lib/timezone";
import type { WorkSessionsGrouping } from "@/lib/workSessionsReportConfig";
import type { ReportTableRow } from "@/types/reportTable";
import type { TimeEntryListItem } from "@/types/timeEntry";

function sessionRow(entry: TimeEntryListItem, zone: string): ReportTableRow {
  return {
    id: entry.id,
    sortKey: new Date(entry.startedAt).getTime(),
    cells: {
      day: entryDayLabel(entry),
      member: memberLabelOf(entry),
      project: entry.projectName,
      task: entry.taskName ?? "-",
      manual: entry.type === "manual" || entry.source === "manual" ? "Yes" : "No",
      started: formatTimeInZone(entry.startedAt, zone),
      stopped: entry.endedAt ? formatTimeInZone(entry.endedAt, zone) : "In progress",
      duration: entry.endedAt ? formatElapsed(entrySeconds(entry, null) * 1000) : "-",
    },
  };
}

/**
 * One row per date / project / member, each opening onto that group's work
 * sessions (every timer run, not merged) in the order they started. A
 * group's duration sums its finished sessions; its "(n)" counts all of them.
 */
export function buildWorkSessionsRows(
  entries: TimeEntryListItem[],
  grouping: WorkSessionsGrouping,
  zone: string,
): ReportTableRow[] {
  return groupEntriesBy(entries, grouping).map((group) => ({
    id: group.id,
    sortKey: group.sortKey,
    cells: {
      group: `${group.label} (${group.entries.length})`,
      duration: formatElapsed(
        group.entries.reduce((sum, entry) => sum + (entry.endedAt ? entrySeconds(entry, null) : 0), 0) * 1000,
      ),
    },
    subRows: [...group.entries]
      .sort((a, b) => new Date(a.startedAt).getTime() - new Date(b.startedAt).getTime())
      .map((entry) => sessionRow(entry, zone)),
  }));
}
