import { API_URL } from "./apiUrl";
import type { CreateTeamResult } from "@/types/team";

const GENERIC_ERROR_MESSAGE = "Something went wrong. Please try again.";

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
