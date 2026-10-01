import { API_URL } from "./apiUrl";
import { GENERIC_ERROR_MESSAGE, parseApiErrorMessage } from "./parseApiError";
import type { OrganisationDeletionStatus } from "@/types/organisation";

export type GetOrganisationDeletionStatusResult =
  | { ok: true; status: OrganisationDeletionStatus }
  | { ok: false; message: string };

export async function getOrganisationDeletionStatus(
  organisationId: number,
): Promise<GetOrganisationDeletionStatusResult> {
  let response: Response;
  try {
    response = await fetch(
      `${API_URL}/organisations/${organisationId}/deletion`,
      { method: "GET", credentials: "include" },
    );
  } catch {
    return { ok: false, message: GENERIC_ERROR_MESSAGE };
  }

  if (response.ok) {
    return { ok: true, status: await response.json() };
  }
  return { ok: false, message: await parseApiErrorMessage(response) };
}
