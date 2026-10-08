import { formatEditTimespan } from "@/lib/formatEditTimespan";
import { formatTimeChange } from "@/lib/formatTimeChange";
import { MANUAL_TIME_EDIT_ACTION_LABELS } from "@/lib/manualTimeEditsReportConfig";
import { formatTimeInZone } from "@/lib/timezone";
import type { ManualTimeEdit } from "@/types/manualTimeEdit";
import type { ReportTableRow } from "@/types/reportTable";

/** One row per edit, newest first. A missing project, task or reason reads "-". */
export function buildManualTimeEditRows(edits: ManualTimeEdit[], zone: string): ReportTableRow[] {
  return edits.map((edit) => {
    const changedAt = new Date(edit.changedAt);
    const day = new Intl.DateTimeFormat([], { timeZone: zone, month: "short", day: "numeric" }).format(changedAt);
    return {
      id: edit.id,
      sortKey: -changedAt.getTime(),
      cells: {
        member: edit.memberName ?? edit.memberEmail ?? "-",
        project: edit.projectName ?? "-",
        task: edit.taskName ?? "-",
        action: MANUAL_TIME_EDIT_ACTION_LABELS[edit.action],
        timespan: formatEditTimespan(edit.startedAt, edit.endedAt, zone),
        change: formatTimeChange(edit.changeSeconds),
        reason: edit.reason ?? "-",
        changedBy: edit.changedByName ?? "-",
        changedAt: `${day}, ${formatTimeInZone(changedAt, zone)}`,
      },
    };
  });
}
