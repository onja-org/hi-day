import type { ManualTimeEdit } from "@/types/manualTimeEdit";
import type { ReportFilterOption } from "@/types/reportFilterOption";

/**
 * The projects the filter offers: the ones the viewer can work on, plus any
 * that appear in the edits on screen — a deleted or archived project's past
 * edits stay reachable. Assigned names win, as an edit's may be stale.
 */
export function manualTimeEditProjectOptions(
  assigned: ReportFilterOption[],
  edits: ManualTimeEdit[],
): ReportFilterOption[] {
  const byId = new Map(assigned.map((project) => [project.id, project.name]));
  for (const edit of edits) {
    if (edit.projectId && edit.projectName && !byId.has(edit.projectId)) {
      byId.set(edit.projectId, edit.projectName);
    }
  }
  return [...byId.entries()]
    .map(([id, name]) => ({ id, name }))
    .sort((a, b) => a.name.localeCompare(b.name));
}
