import { API_URL } from "./apiUrl";
import { GENERIC_ERROR_MESSAGE, parseApiErrorMessage } from "./parseApiError";
import type { GetSavedReportsResult, SavedReport } from "@/types/savedReport";

export async function getSavedReports(organisationId: string): Promise<GetSavedReportsResult> {
  let response: Response;
  try {
    response = await fetch(`${API_URL}/organisations/${organisationId}/saved-reports`, {
      method: "GET",
      credentials: "include",
    });
  } catch {
    return { ok: false, message: GENERIC_ERROR_MESSAGE };
  }

  if (response.ok) {
    return { ok: true, reports: (await response.json()) as SavedReport[] };
  }
  return { ok: false, message: await parseApiErrorMessage(response) };
}
