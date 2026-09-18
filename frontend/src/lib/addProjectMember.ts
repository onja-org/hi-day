import { API_URL } from "./apiUrl";
import { GENERIC_ERROR_MESSAGE, parseApiErrorMessage } from "./parseApiError";
import type { AddProjectMemberInput, AddProjectMemberResult } from "@/types/project";

export async function addProjectMember(
  organisationId: string,
  projectId: string,
  input: AddProjectMemberInput,
): Promise<AddProjectMemberResult> {
  let response: Response;
  try {
    response = await fetch(
      `${API_URL}/organisations/${organisationId}/projects/${projectId}/members`,
      {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
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
