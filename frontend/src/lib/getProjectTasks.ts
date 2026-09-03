import { API_URL } from "./apiUrl";
import type { GetProjectTasksResult } from "@/types/task";

const GENERIC_ERROR_MESSAGE = "Something went wrong. Please try again.";

export async function getProjectTasks(
  organisationId: string,
  projectId: string,
): Promise<GetProjectTasksResult> {
  let response: Response;
  try {
    response = await fetch(
      `${API_URL}/organisations/${organisationId}/projects/${projectId}/tasks`,
      { method: "GET", credentials: "include" },
    );
  } catch {
    return { ok: false, message: GENERIC_ERROR_MESSAGE };
  }

  if (response.ok) {
    const data = await response.json();
    return { ok: true, data };
  }

  const data = (await response.json().catch(() => null)) as {
    message?: string[] | string;
  } | null;
  const message = Array.isArray(data?.message)
    ? data.message[0]
    : data?.message;
  return { ok: false, message: message ?? GENERIC_ERROR_MESSAGE };
}
