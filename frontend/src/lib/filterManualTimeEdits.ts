import type { ReportFilters } from "@/lib/reportFilters";
import type { ManualTimeEdit, ManualTimeEditAction } from "@/types/manualTimeEdit";

/** Edits by the chosen members, in the chosen projects, of the chosen action; an empty choice narrows nothing. */
export function filterManualTimeEdits(
  edits: ManualTimeEdit[],
  filters: ReportFilters,
  action: ManualTimeEditAction | "all",
): ManualTimeEdit[] {
  return edits.filter(
    (edit) =>
      (action === "all" || edit.action === action) &&
      (filters.memberIds.length === 0 || (edit.membershipId !== null && filters.memberIds.includes(edit.membershipId))) &&
      (filters.projectIds.length === 0 || (edit.projectId !== null && filters.projectIds.includes(edit.projectId))),
  );
}
