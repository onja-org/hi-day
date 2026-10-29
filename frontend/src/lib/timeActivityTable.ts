import { buildTimeActivityRows } from "@/lib/buildTimeActivityRows";
import { timeActivityColumns } from "@/lib/timeActivityReportConfig";
import type { IdleMember } from "@/types/idleMember";
import type { WeekStart } from "@/types/organisation";
import type { ReportTableColumn, ReportTableRow } from "@/types/reportTable";
import type { MembershipTeamNames, TimeActivityGrouping } from "@/types/timeActivityGrouping";
import type { TimeEntryListItem } from "@/types/timeEntry";

/** The Time and activity table as grouped on screen, for the PDF export and attachment. */
export function timeActivityTable(
  entries: TimeEntryListItem[],
  grouping: TimeActivityGrouping,
  teamNames: MembershipTeamNames,
  idleMembers: IdleMember[],
  weekStart: WeekStart,
  projectsEnabled: boolean,
  zone?: string,
): { columns: ReportTableColumn[]; rows: ReportTableRow[] } {
  return {
    columns: timeActivityColumns(grouping, projectsEnabled),
    rows: buildTimeActivityRows(entries, grouping, { sumDates: false, teamNames, idleMembers, weekStart, zone }),
  };
}
