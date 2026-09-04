import { API_URL } from "./apiUrl";
import type { TimeEntry, TimeEntryActionResult } from "@/types/timeEntry";

const GENERIC_ERROR_MESSAGE = "Something went wrong. Please try again.";

export async function startTimeEntry(
  organisationId: string,
  projectId: string,
  taskId: string | null,
): Promise<TimeEntryActionResult> {
  let response: Response;
  try {
    response = await fetch(
      `${API_URL}/organisations/${organisationId}/projects/${projectId}/time-entries/start`,
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
    const entry = await response.json();
    return { ok: true, entry };
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
