import { PROJECT_WORK_ORDER_LABEL } from "@/lib/reportColumnLabels";
import type { ReportTableColumn } from "@/types/reportTable";
import type { TimeActivityGrouping } from "@/types/timeActivityGrouping";

export type WorkSessionsGrouping = Extract<TimeActivityGrouping, "day" | "project" | "member">;

export const WORK_SESSIONS_GROUPINGS: { value: WorkSessionsGrouping; label: string }[] = [
  { value: "day", label: "Date" },
  { value: "project", label: PROJECT_WORK_ORDER_LABEL },
  { value: "member", label: "Member" },
];

/** Without Projects there is no project to group by. */
export function workSessionsGroupings(projectsEnabled: boolean): typeof WORK_SESSIONS_GROUPINGS {
  return projectsEnabled ? WORK_SESSIONS_GROUPINGS : WORK_SESSIONS_GROUPINGS.filter((option) => option.value !== "project");
}

/** A saved report may hold a grouping this report doesn't offer; it falls back to the date. */
export function isWorkSessionsGrouping(
  value: TimeActivityGrouping,
  projectsEnabled = true,
): value is WorkSessionsGrouping {
  return workSessionsGroupings(projectsEnabled).some((option) => option.value === value);
}

const DETAIL_COLUMNS: ReportTableColumn[] = [
  { key: "day", header: "Date" },
  { key: "member", header: "Member" },
  { key: "project", header: PROJECT_WORK_ORDER_LABEL },
  { key: "task", header: "To-do / Job" },
  { key: "manual", header: "Manual" },
  { key: "started", header: "Started" },
  { key: "stopped", header: "Stopped" },
  { key: "duration", header: "Duration" },
];

/** The grouping names the first column, so its own detail column is left out of the rest. */
export function workSessionsColumns(grouping: WorkSessionsGrouping, projectsEnabled = true): ReportTableColumn[] {
  const label = WORK_SESSIONS_GROUPINGS.find((option) => option.value === grouping)!.label;
  return [
    { key: "group", header: label },
    ...DETAIL_COLUMNS.filter((column) => column.key !== grouping && (projectsEnabled || column.key !== "project")),
  ];
}
