import { groupEntriesBy } from "@/lib/groupEntriesBy";
import { splitEntrySeconds } from "@/lib/splitEntrySeconds";
import type { WeekStart } from "@/types/organisation";
import type { ReportChartRow } from "@/types/reportChart";
import type { MembershipTeamNames, TimeActivityGrouping } from "@/types/timeActivityGrouping";
import type { TimeEntryListItem } from "@/types/timeEntry";

/** One chart slot per group, split into `tracked` and `manual` seconds. "None" has no groups, so it has no chart rows. */
export function buildTimeActivityChartRows(
  entries: TimeEntryListItem[],
  grouping: TimeActivityGrouping,
  teamNames: MembershipTeamNames,
  weekStart: WeekStart = "monday",
  zone?: string,
): ReportChartRow[] {
  if (grouping === "none") return [];
  return groupEntriesBy(entries, grouping, teamNames, weekStart, zone).map((group) => ({
    label: group.label,
    values: splitEntrySeconds(group.entries),
  }));
}
