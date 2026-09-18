import { API_URL } from "./apiUrl";
import { GENERIC_ERROR_MESSAGE, parseApiErrorMessage } from "./parseApiError";
import type { AddProjectTeamInput, AddProjectTeamResult } from "@/types/project";

export async function addProjectTeam(
  organisationId: string,
  projectId: string,
  input: AddProjectTeamInput,
): Promise<AddProjectTeamResult> {
  let response: Response;
  try {
    response = await fetch(
      `${API_URL}/organisations/${organisationId}/projects/${projectId}/teams`,
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
