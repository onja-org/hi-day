import { API_URL } from "./apiUrl";
import type {
  CreateManualTimeEntryResult,
  TimeEntryFormInput,
} from "@/types/timeEntry";

const GENERIC_ERROR_MESSAGE = "Something went wrong. Please try again.";

export async function createManualTimeEntry(
  organisationId: string,
  input: TimeEntryFormInput,
): Promise<CreateManualTimeEntryResult> {
  let response: Response;
  try {
    response = await fetch(
      `${API_URL}/organisations/${organisationId}/projects/${input.projectId}/time-entries`,
      {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          taskId: input.taskId,
          startedAt: new Date(input.startedAt).toISOString(),
          endedAt: new Date(input.endedAt).toISOString(),
        }),
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
  } | null;
  const message = Array.isArray(data?.message)
    ? data.message[0]
    : data?.message;
  return { ok: false, message: message ?? GENERIC_ERROR_MESSAGE };
}
