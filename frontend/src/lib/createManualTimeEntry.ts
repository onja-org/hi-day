import { API_URL } from "./apiUrl";
import { GENERIC_ERROR_MESSAGE, parseApiErrorMessage } from "./parseApiError";
import type {
  CreateManualTimeEntryResult,
  TimeEntryFormInput,
} from "@/types/timeEntry";

export async function createManualTimeEntry(
  organisationId: string,
  input: TimeEntryFormInput,
): Promise<CreateManualTimeEntryResult> {
  let response: Response;
  try {
    response = await fetch(
      input.projectId
        ? `${API_URL}/organisations/${organisationId}/projects/${input.projectId}/time-entries`
        : `${API_URL}/organisations/${organisationId}/time-entries`,
      {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          taskId: input.taskId,
          startedAt: new Date(input.startedAt).toISOString(),
          endedAt: new Date(input.endedAt).toISOString(),
          membershipId: input.membershipId,
          reason: input.reason,
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
