import { API_URL } from "./apiUrl";
import type { ProjectFormInput, UpdateProjectResult } from "@/types/project";

const GENERIC_ERROR_MESSAGE = "Something went wrong. Please try again.";

export async function updateProject(
  organisationId: string,
  projectId: string,
  input: Partial<ProjectFormInput>,
): Promise<UpdateProjectResult> {
  let response: Response;
  try {
    response = await fetch(
      `${API_URL}/organisations/${organisationId}/projects/${projectId}`,
      {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      },
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
