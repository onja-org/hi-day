import { API_URL } from "./apiUrl";
import { GENERIC_ERROR_MESSAGE, parseApiErrorMessage } from "./parseApiError";
import type { TimeEntryActionResult } from "@/types/timeEntry";

export async function switchTimeEntry(
  organisationId: string,
  /** null when the organisation doesn't track time against Projects. */
  projectId: string | null,
  taskId: string | null,
): Promise<TimeEntryActionResult> {
  let response: Response;
  try {
    response = await fetch(
      `${API_URL}/organisations/${organisationId}/time-entries/switch`,
      {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...(projectId ? { projectId } : {}),
          ...(taskId ? { taskId } : {}),
        }),
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
