import { PROJECT_WORK_ORDER_LABEL } from "@/lib/reportColumnLabels";
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

export const TIME_ACTIVITY_COLUMNS: ReportTableColumn[] = [
  { key: "date", header: "Date" },
  { key: "project", header: PROJECT_WORK_ORDER_LABEL, group: "Info" },
  { key: "team", header: "Team", group: "Info" },
  { key: "regular", header: "Regular hours", group: "Time" },
  { key: "total", header: "Total hours", group: "Time" },
  { key: "idlePercent", header: "Idle (%)", group: "Activity" },
  { key: "idlePerHour", header: "Idle (hr)", group: "Activity" },
];

export const TIME_ACTIVITY_GROUPINGS: {
  value: TimeActivityGrouping;
  label: string;
}[] = [
  { value: "none", label: "None" },
  { value: "day", label: "Date per day" },
  { value: "week", label: "Date per week" },
  { value: "project", label: PROJECT_WORK_ORDER_LABEL },
  { value: "member", label: "Member" },
  { value: "team", label: "Team" },
];

const FIRST_COLUMN_HEADERS: Record<TimeActivityGrouping, string> = {
  none: "Member",
  day: "Date",
  week: "Date",
  project: PROJECT_WORK_ORDER_LABEL,
  member: "Member",
  team: "Team",
};

/** Without Projects there is no project to group by. */
export function timeActivityGroupings(projectsEnabled: boolean): typeof TIME_ACTIVITY_GROUPINGS {
  return projectsEnabled ? TIME_ACTIVITY_GROUPINGS : TIME_ACTIVITY_GROUPINGS.filter((option) => option.value !== "project");
}

/** Columns the grouping already spells out in its first column, so repeating them would be noise. */
const REDUNDANT_COLUMN: Partial<Record<TimeActivityGrouping, string>> = {
  project: "project",
  team: "team",
};

/** The first column names whatever the rows are grouped by (and its own column is dropped); "None" lists entries by member, so it gets a separate Date column. */
export function timeActivityColumns(
  grouping: TimeActivityGrouping,
  projectsEnabled = true,
): ReportTableColumn[] {
  const [, ...allRest] = TIME_ACTIVITY_COLUMNS;
  const rest = projectsEnabled ? allRest : allRest.filter((column) => column.key !== "project");
  return [
    { key: "date", header: FIRST_COLUMN_HEADERS[grouping] },
    ...(grouping === "none"
      ? [{ key: "when", header: "Date", group: "Info" }]
      : []),
    ...rest.filter((column) => column.key !== REDUNDANT_COLUMN[grouping]),
  ];
}

/** Groupings that split into days underneath, where "Sum dates" can fold that level away. */
export function canSumDates(grouping: TimeActivityGrouping): boolean {
  return ["project", "member", "team"].includes(grouping);
}
