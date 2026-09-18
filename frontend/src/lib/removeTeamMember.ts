import { API_URL } from "./apiUrl";
import { GENERIC_ERROR_MESSAGE, parseApiErrorMessage } from "./parseApiError";
import type { TeamActionResult } from "@/types/team";

export async function removeTeamMember(
  organisationId: string,
  teamId: string,
  membershipId: string,
): Promise<TeamActionResult> {
  let response: Response;
  try {
    response = await fetch(
      `${API_URL}/organisations/${organisationId}/teams/${teamId}/members/${membershipId}`,
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
