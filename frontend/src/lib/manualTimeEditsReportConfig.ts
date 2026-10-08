import { PROJECT_WORK_ORDER_LABEL } from "@/lib/reportColumnLabels";
import type { ManualTimeEditAction } from "@/types/manualTimeEdit";
import type { ReportTableColumn } from "@/types/reportTable";

export const MANUAL_TIME_EDIT_ACTION_LABELS: Record<ManualTimeEditAction, string> = {
  add: "Add",
  edit: "Edit",
  delete: "Delete",
};

export const MANUAL_TIME_EDITS_COLUMNS: ReportTableColumn[] = [
  { key: "member", header: "Member" },
  { key: "project", header: PROJECT_WORK_ORDER_LABEL },
  { key: "task", header: "To-do / Job" },
  { key: "action", header: "Action" },
  { key: "timespan", header: "Timespan" },
  { key: "change", header: "Time change" },
  { key: "reason", header: "Reason" },
  { key: "changedBy", header: "Changed by" },
  { key: "changedAt", header: "Changed at" },
];
