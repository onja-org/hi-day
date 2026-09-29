import { API_URL } from "./apiUrl";
import { GENERIC_ERROR_MESSAGE, parseApiErrorMessage } from "./parseApiError";
import type { DeleteTimeEntryResult } from "@/types/timeEntry";

export async function deleteTimeEntry(
  organisationId: string,
  timeEntryId: string,
  reason?: string,
): Promise<DeleteTimeEntryResult> {
  let response: Response;
  try {
    response = await fetch(
      `${API_URL}/organisations/${organisationId}/time-entries/${timeEntryId}`,
      {
        method: "DELETE",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        // Always a JSON body, even when empty: the route validates a DTO, so
        // sending nothing at all would fail parsing rather than validation.
        body: JSON.stringify(reason ? { reason } : {}),
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
