import { groupEntriesBy } from "@/lib/groupEntriesBy";
import { splitEntrySeconds } from "@/lib/splitEntrySeconds";
import type { ReportChartRow } from "@/types/reportChart";
import type { TimeActivityGrouping } from "@/types/timeActivityGrouping";
import type { TimeEntryListItem } from "@/types/timeEntry";

/** One chart slot per group, split into `tracked` and `manual` seconds. "None" has no groups to show, so it charts by day. */
export function buildTimeActivityChartRows(
  entries: TimeEntryListItem[],
  grouping: TimeActivityGrouping,
): ReportChartRow[] {
  return groupEntriesBy(entries, grouping === "none" ? "day" : grouping).map((group) => ({
    label: group.label,
    values: splitEntrySeconds(group.entries),
  }));
}
