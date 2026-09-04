import { API_URL } from "./apiUrl";
import type { UpdateTeamResult } from "@/types/team";

const GENERIC_ERROR_MESSAGE = "Something went wrong. Please try again.";

export async function updateTeam(
  organisationId: string,
  teamId: string,
  name: string,
): Promise<UpdateTeamResult> {
  let response: Response;
  try {
    response = await fetch(
      `${API_URL}/organisations/${organisationId}/teams/${teamId}`,
      {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      },
    );
  } catch {
    return { ok: false, message: GENERIC_ERROR_MESSAGE };
  }

  if (response.ok) {
    const team = await response.json();
    return { ok: true, team };
  }

  const data = (await response.json().catch(() => null)) as {
    message?: string[] | string;
  } | null;
  const message = Array.isArray(data?.message)
    ? data.message[0]
    : data?.message;
  return { ok: false, message: message ?? GENERIC_ERROR_MESSAGE };
}
