import { API_URL } from "./apiUrl";
import { GENERIC_ERROR_MESSAGE } from "./parseApiError";
import type { TimeEntry, TimeEntryActionResult } from "@/types/timeEntry";

export async function startTimeEntry(
  organisationId: string,
  /** null when the organisation doesn't track time against Projects. */
  projectId: string | null,
  taskId: string | null,
): Promise<TimeEntryActionResult> {
  let response: Response;
  try {
    response = await fetch(
      projectId === null
        ? `${API_URL}/organisations/${organisationId}/time-entries/start`
        : `${API_URL}/organisations/${organisationId}/projects/${projectId}/time-entries/start`,
      {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(taskId ? { taskId } : {}),
      },
    );
  } catch {
    return { ok: false, message: GENERIC_ERROR_MESSAGE };
  }

  if (response.ok) {
    const body = await response.json();
    return { ok: true, ...body };
  }

  const data = (await response.json().catch(() => null)) as {
    message?: string[] | string;
    runningEntry?: TimeEntry;
  } | null;
  const message = Array.isArray(data?.message)
    ? data.message[0]
    : data?.message;
  return {
    ok: false,
    message: message ?? GENERIC_ERROR_MESSAGE,
    runningEntry: data?.runningEntry,
  };
}
