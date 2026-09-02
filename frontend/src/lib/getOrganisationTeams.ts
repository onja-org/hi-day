import { API_URL } from "./apiUrl";
import type { GetOrganisationTeamsResult } from "@/types/invitation";

const GENERIC_ERROR_MESSAGE = "Something went wrong. Please try again.";

export async function getOrganisationTeams(
  organisationId: string,
): Promise<GetOrganisationTeamsResult> {
  let response: Response;
  try {
    response = await fetch(
      `${API_URL}/organisations/${organisationId}/teams`,
      { method: "GET", credentials: "include" },
    );
  } catch {
    return { ok: false, message: GENERIC_ERROR_MESSAGE };
  }

  if (response.ok) {
    const teams = await response.json();
    return { ok: true, teams };
  }

  const data = (await response.json().catch(() => null)) as {
    message?: string[] | string;
  } | null;
  const message = Array.isArray(data?.message)
    ? data.message[0]
    : data?.message;
  return { ok: false, message: message ?? GENERIC_ERROR_MESSAGE };
}
