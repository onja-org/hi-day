import { API_URL } from "./apiUrl";
import { GENERIC_ERROR_MESSAGE, parseApiErrorMessage } from "./parseApiError";
import type { SaveReportInput, SaveReportResult, SavedReport } from "@/types/savedReport";

/** Adds a saved report, or replaces the one with `input.id`. Saving always replaces the name, settings and schedule together. */
export async function saveSavedReport(
  organisationId: string,
  { id, ...body }: SaveReportInput,
): Promise<SaveReportResult> {
  const base = `${API_URL}/organisations/${organisationId}/saved-reports`;
  let response: Response;
  try {
    response = await fetch(id ? `${base}/${id}` : base, {
      method: id ? "PUT" : "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch {
    return { ok: false, message: GENERIC_ERROR_MESSAGE };
  }

  if (response.ok) {
    const result = (await response.json()) as { report: SavedReport };
    return { ok: true, report: result.report };
  }
  return { ok: false, message: await parseApiErrorMessage(response) };
}
