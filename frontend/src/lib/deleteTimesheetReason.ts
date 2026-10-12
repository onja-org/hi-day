import { API_URL } from "./apiUrl";
import { GENERIC_ERROR_MESSAGE, parseApiErrorMessage } from "./parseApiError";
import type { DeleteTimesheetReasonResult } from "@/types/timesheetReason";

/** Removes one Reason from the picker. Admin-only. Nothing references it,
 * so recorded history is untouched. */
export async function deleteTimesheetReason(
  organisationId: string,
  reasonId: string,
): Promise<DeleteTimesheetReasonResult> {
  let response: Response;
  try {
    response = await fetch(
      `${API_URL}/organisations/${organisationId}/timesheet-reasons/${reasonId}`,
      { method: "DELETE", credentials: "include" },
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
