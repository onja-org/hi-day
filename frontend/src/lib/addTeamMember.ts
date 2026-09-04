import { API_URL } from "./apiUrl";
import type { AddTeamMemberInput, TeamActionResult } from "@/types/team";

const GENERIC_ERROR_MESSAGE = "Something went wrong. Please try again.";

export async function addTeamMember(
  organisationId: string,
  teamId: string,
  input: AddTeamMemberInput,
): Promise<TeamActionResult> {
  let response: Response;
  try {
    response = await fetch(
      `${API_URL}/organisations/${organisationId}/teams/${teamId}/members`,
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
    return { ok: true };
  }

  const data = (await response.json().catch(() => null)) as {
    message?: string[] | string;
  } | null;
  const message = Array.isArray(data?.message)
    ? data.message[0]
    : data?.message;
  return { ok: false, message: message ?? GENERIC_ERROR_MESSAGE };
}
