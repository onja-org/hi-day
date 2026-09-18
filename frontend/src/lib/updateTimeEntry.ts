import { API_URL } from "./apiUrl";
import { GENERIC_ERROR_MESSAGE, parseApiErrorMessage } from "./parseApiError";
import type {
  UpdateTimeEntryInput,
  UpdateTimeEntryResult,
} from "@/types/timeEntry";

export async function updateTimeEntry(
  organisationId: string,
  timeEntryId: string,
  input: UpdateTimeEntryInput,
): Promise<UpdateTimeEntryResult> {
  const body: Record<string, unknown> = {};
  if (input.projectId !== undefined) body.projectId = input.projectId;
  if (input.taskId !== undefined) body.taskId = input.taskId;
  if (input.startedAt !== undefined) {
    body.startedAt = new Date(input.startedAt).toISOString();
  }
  if (input.endedAt !== undefined) {
    body.endedAt = new Date(input.endedAt).toISOString();
  }

  let response: Response;
  try {
    response = await fetch(
      `${API_URL}/organisations/${organisationId}/time-entries/${timeEntryId}`,
      {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
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
