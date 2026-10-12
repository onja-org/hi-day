import { API_URL } from "./apiUrl";
import { GENERIC_ERROR_MESSAGE, parseApiErrorMessage } from "./parseApiError";
import type { UpsertTimesheetReasonResult } from "@/types/timesheetReason";

/** Renames one Reason. Admin-only. Already-recorded history keeps the old
 * wording — the label is copied onto the audit row when it's picked. */
export async function renameTimesheetReason(
  organisationId: string,
  reasonId: string,
  label: string,
): Promise<UpsertTimesheetReasonResult> {
  let response: Response;
  try {
    response = await fetch(
      `${API_URL}/organisations/${organisationId}/timesheet-reasons/${reasonId}`,
      {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label }),
      },
    );
  } catch {
    return { ok: false, message: GENERIC_ERROR_MESSAGE };
  }

  if (response.ok) {
    const body = await response.json();
    return { ok: true, ...body };
  }

  return { ok: false, message: await parseApiErrorMessage(response) };
}
