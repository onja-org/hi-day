import { API_URL } from "./apiUrl";
import { GENERIC_ERROR_MESSAGE, parseApiErrorMessage } from "./parseApiError";
import type { SavedReport, SetSchedulePausedResult } from "@/types/savedReport";

/** Puts a saved report's scheduled emails on hold, or resumes them. */
export async function setSavedReportSchedulePaused(
  organisationId: string,
  savedReportId: string,
  paused: boolean,
): Promise<SetSchedulePausedResult> {
  let response: Response;
  try {
    response = await fetch(
      `${API_URL}/organisations/${organisationId}/saved-reports/${savedReportId}/schedule-paused`,
      {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paused }),
      },
    );
  } catch {
    return { ok: false, message: GENERIC_ERROR_MESSAGE };
  }

  if (response.ok) {
    const result = (await response.json()) as { report: SavedReport };
    return { ok: true, report: result.report };
  }
  return { ok: false, message: await parseApiErrorMessage(response) };
}
