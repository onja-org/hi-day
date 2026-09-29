import { API_URL } from "./apiUrl";
import { GENERIC_ERROR_MESSAGE, parseApiErrorMessage } from "./parseApiError";
import type { SetTaskStageResult, TaskStage } from "@/types/task";

export async function setTaskStage(
  organisationId: string,
  projectId: string,
  taskId: string,
  stage: TaskStage,
): Promise<SetTaskStageResult> {
  let response: Response;
  try {
    response = await fetch(
      `${API_URL}/organisations/${organisationId}/projects/${projectId}/tasks/${taskId}/stage`,
      {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stage }),
      },
    );
  } catch {
    return { ok: false, message: GENERIC_ERROR_MESSAGE };
  }

  if (response.ok) {
    return { ok: true, ...(await response.json()) };
  }
  return { ok: false, message: await parseApiErrorMessage(response) };
}
