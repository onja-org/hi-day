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
  { value: "team", label: "Team" },
  { value: "todo", label: "To-do / Job" },
];

const FIRST_COLUMN_HEADERS: Record<TimeActivityGrouping, string> = {
  none: "Member",
  day: "Date",
  week: "Date",
  project: "Project / Work order",
  member: "Member",
  team: "Team",
  todo: "To-do / Job",
};

/** Columns the grouping already spells out in its first column, so repeating them would be noise. */
const REDUNDANT_COLUMN: Partial<Record<TimeActivityGrouping, string>> = {
  project: "project",
  team: "team",
};

/** The first column names whatever the rows are grouped by (and its own column is dropped); "None" lists entries by member, so it gets a separate Date column. */
export function timeActivityColumns(grouping: TimeActivityGrouping): ReportTableColumn[] {
  const [, ...rest] = TIME_ACTIVITY_COLUMNS;
  return [
    { key: "date", header: FIRST_COLUMN_HEADERS[grouping] },
    ...(grouping === "none" ? [{ key: "when", header: "Date", group: "Info" }] : []),
    ...rest.filter((column) => column.key !== REDUNDANT_COLUMN[grouping]),
  ];
}

/** Groupings that split into days underneath, where "Sum dates" can fold that level away. */
export function canSumDates(grouping: TimeActivityGrouping): boolean {
  return ["project", "member", "team", "todo"].includes(grouping);
}
