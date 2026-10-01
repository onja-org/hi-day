import { API_URL } from "./apiUrl";
import { GENERIC_ERROR_MESSAGE, parseApiErrorMessage } from "./parseApiError";
import type { OrganisationDeletionResult } from "@/types/organisation";

/** Cancels a scheduled deletion, or restores an organisation suspended by "delete now". */
export async function cancelOrganisationDeletion(
  organisationId: number,
): Promise<OrganisationDeletionResult> {
  let response: Response;
  try {
    response = await fetch(
      `${API_URL}/organisations/${organisationId}/deletion/cancel`,
      { method: "POST", credentials: "include" },
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
