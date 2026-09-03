import { API_URL } from "./apiUrl";
import type { CloseTaskResult } from "@/types/task";

const GENERIC_ERROR_MESSAGE = "Something went wrong. Please try again.";

export async function closeTask(
  organisationId: string,
  projectId: string,
  taskId: string,
): Promise<CloseTaskResult> {
  let response: Response;
  try {
    response = await fetch(
      `${API_URL}/organisations/${organisationId}/projects/${projectId}/tasks/${taskId}/close`,
      { method: "POST", credentials: "include" },
    );
  } catch {
    return { ok: false, message: GENERIC_ERROR_MESSAGE };
  }

  if (response.ok) {
    const task = await response.json();
    return { ok: true, task };
  }

  const data = (await response.json().catch(() => null)) as {
    message?: string[] | string;
  } | null;
  const message = Array.isArray(data?.message)
    ? data.message[0]
    : data?.message;
  return { ok: false, message: message ?? GENERIC_ERROR_MESSAGE };
}
