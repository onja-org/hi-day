import { API_URL } from "./apiUrl";
import type { GetProjectResult } from "@/types/project";

const GENERIC_ERROR_MESSAGE = "Something went wrong. Please try again.";

export async function getProject(
  organisationId: string,
  projectId: string,
): Promise<GetProjectResult> {
  let response: Response;
  try {
    response = await fetch(
      `${API_URL}/organisations/${organisationId}/projects/${projectId}`,
      { method: "GET", credentials: "include" },
    );
  } catch {
    return { ok: false, message: GENERIC_ERROR_MESSAGE };
  }

  if (response.ok) {
    const project = await response.json();
    return { ok: true, project };
  }

  const data = (await response.json().catch(() => null)) as {
    message?: string[] | string;
  } | null;
  const message = Array.isArray(data?.message)
    ? data.message[0]
    : data?.message;
  return { ok: false, message: message ?? GENERIC_ERROR_MESSAGE };
}
