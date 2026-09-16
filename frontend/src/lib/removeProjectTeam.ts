import { API_URL } from "./apiUrl";
import type { RemoveProjectTeamResult } from "@/types/project";

const GENERIC_ERROR_MESSAGE = "Something went wrong. Please try again.";

export async function removeProjectTeam(
  organisationId: string,
  projectId: string,
  teamId: string,
): Promise<RemoveProjectTeamResult> {
  let response: Response;
  try {
    response = await fetch(
      `${API_URL}/organisations/${organisationId}/projects/${projectId}/teams/${teamId}`,
      { method: "DELETE", credentials: "include" },
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
