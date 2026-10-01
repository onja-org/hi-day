import { API_URL } from "./apiUrl";
import { GENERIC_ERROR_MESSAGE, parseApiErrorMessage } from "./parseApiError";
import type { OrganisationDeletionResult } from "@/types/organisation";

/** Applies the pending request using the token from the owner's emailed link. */
export async function confirmOrganisationDeletion(
  organisationId: number,
  token: string,
): Promise<OrganisationDeletionResult> {
  let response: Response;
  try {
    response = await fetch(
      `${API_URL}/organisations/${organisationId}/deletion/confirm`,
      {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      },
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
