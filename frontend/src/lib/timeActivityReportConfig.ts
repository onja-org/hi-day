import type { ReportChartSeries } from "@/types/reportChart";
import type { ReportTableColumn } from "@/types/reportTable";
import type { TimeActivityGrouping } from "@/types/timeActivityGrouping";

export const TIME_ACTIVITY_CHART_SERIES: ReportChartSeries[] = [
  { key: "tracked", label: "Tracked", color: "var(--color-primary)" },
  {
    key: "manual",
    label: "Manual",
    color: "color-mix(in srgb, var(--color-primary) 40%, transparent)",
  },
];

// Idle, PTO, Holiday, Team and the Earned columns have no data source yet
// (no idle tracking per entry, no leave or pay-rate model), so their cells
// are left empty and render as "-".
export const TIME_ACTIVITY_COLUMNS: ReportTableColumn[] = [
  { key: "date", header: "Date" },
  { key: "member", header: "Member", group: "Info" },
  { key: "project", header: "Project / Work order", group: "Info" },
  { key: "todo", header: "To-do / Job", group: "Info" },
  { key: "team", header: "Team", group: "Info" },
  { key: "regular", header: "Regular hours", group: "Time" },
  { key: "breakTime", header: "Break time", group: "Time" },
  { key: "manual", header: "Manual hours", group: "Time" },
  { key: "total", header: "Total hours", group: "Time" },
  { key: "idlePercent", header: "Idle (%)", group: "Activity" },
  { key: "pto", header: "PTO", group: "Leave" },
  { key: "holiday", header: "Holiday", group: "Leave" },
  { key: "totalEarned", header: "Total earned", group: "Earned" },
  { key: "regularEarned", header: "Regular earned", group: "Earned" },
  { key: "ptoEarned", header: "PTO earned", group: "Earned" },
  { key: "holidayEarned", header: "Holiday earned", group: "Earned" },
];

export const TIME_ACTIVITY_DEFAULT_HIDDEN_COLUMNS = ["todo", "breakTime", "manual"];

export const TIME_ACTIVITY_GROUPINGS: { value: TimeActivityGrouping; label: string }[] = [
  { value: "none", label: "None" },
  { value: "day", label: "Date per day" },
  { value: "week", label: "Date per week" },
  { value: "project", label: "Project / Work order" },
  { value: "member", label: "Member" },
  { value: "todo", label: "To-do / Job" },
];

/** The first column names whatever the rows are grouped by. */
export function timeActivityColumns(grouping: TimeActivityGrouping): ReportTableColumn[] {
  const firstHeader =
    grouping === "none" || grouping === "day" || grouping === "week"
      ? "Date"
      : (TIME_ACTIVITY_GROUPINGS.find((option) => option.value === grouping)?.label ?? "Date");
  return TIME_ACTIVITY_COLUMNS.map((column, index) =>
    index === 0 ? { ...column, header: firstHeader } : column,
  );
}
