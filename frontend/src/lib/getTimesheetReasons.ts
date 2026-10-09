import { API_URL } from "./apiUrl";
import { GENERIC_ERROR_MESSAGE, parseApiErrorMessage } from "./parseApiError";
import type { GetTimesheetReasonsResult } from "@/types/timesheetReason";

/** The organisation's Reasons list. Open to every role — the add, edit and
 * delete-time pickers need it, and a plain member uses those. */
export async function getTimesheetReasons(
  organisationId: string,
): Promise<GetTimesheetReasonsResult> {
  let response: Response;
  try {
    response = await fetch(
      `${API_URL}/organisations/${organisationId}/timesheet-reasons`,
      { credentials: "include" },
    );
  } catch {
    return { ok: false, message: GENERIC_ERROR_MESSAGE };
  }

  if (response.ok) {
    return { ok: true, reasons: await response.json() };
  }

  return { ok: false, message: await parseApiErrorMessage(response) };
}
