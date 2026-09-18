import { API_URL } from "./apiUrl";
import { GENERIC_ERROR_MESSAGE, parseApiErrorMessage } from "./parseApiError";
import type { ReopenTaskResult } from "@/types/task";

export async function reopenTask(
  organisationId: string,
  projectId: string,
  taskId: string,
): Promise<ReopenTaskResult> {
  let response: Response;
  try {
    response = await fetch(
      `${API_URL}/organisations/${organisationId}/projects/${projectId}/tasks/${taskId}/reopen`,
      { method: "POST", credentials: "include" },
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
