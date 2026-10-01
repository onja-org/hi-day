import { API_URL } from "./apiUrl";
import { GENERIC_ERROR_MESSAGE, parseApiErrorMessage } from "./parseApiError";
import type { DeleteSavedReportResult } from "@/types/savedReport";

export async function deleteSavedReport(
  organisationId: string,
  savedReportId: string,
): Promise<DeleteSavedReportResult> {
  let response: Response;
  try {
    response = await fetch(
      `${API_URL}/organisations/${organisationId}/saved-reports/${savedReportId}`,
      { method: "DELETE", credentials: "include" },
    );
  } catch {
    return { ok: false, message: GENERIC_ERROR_MESSAGE };
  }

  if (response.ok) return { ok: true };
  return { ok: false, message: await parseApiErrorMessage(response) };
}
