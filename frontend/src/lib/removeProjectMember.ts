import { API_URL } from "./apiUrl";
import { GENERIC_ERROR_MESSAGE, parseApiErrorMessage } from "./parseApiError";
import type { RemoveProjectMemberResult } from "@/types/project";

export async function removeProjectMember(
  organisationId: string,
  projectId: string,
  membershipId: string,
): Promise<RemoveProjectMemberResult> {
  let response: Response;
  try {
    response = await fetch(
      `${API_URL}/organisations/${organisationId}/projects/${projectId}/members/${membershipId}`,
      { method: "DELETE", credentials: "include" },
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
