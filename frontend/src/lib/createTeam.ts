import { API_URL } from "./apiUrl";
import { GENERIC_ERROR_MESSAGE, parseApiErrorMessage } from "./parseApiError";
import type { CreateTeamResult } from "@/types/team";

export async function createTeam(
  organisationId: string,
  name: string,
): Promise<CreateTeamResult> {
  let response: Response;
  try {
    response = await fetch(`${API_URL}/organisations/${organisationId}/teams`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
  } catch {
    return { ok: false, message: GENERIC_ERROR_MESSAGE };
  }

  if (response.ok) {
    const body = await response.json();
    return { ok: true, ...body };
  }

  return { ok: false, message: await parseApiErrorMessage(response) };
}
