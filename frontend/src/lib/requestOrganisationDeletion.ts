import { API_URL } from "./apiUrl";
import { GENERIC_ERROR_MESSAGE, parseApiErrorMessage } from "./parseApiError";
import type {
  OrganisationDeletionResult,
  RequestOrganisationDeletionInput,
} from "@/types/organisation";

/** Emails the owner a confirmation link; nothing is deleted or suspended yet. */
export async function requestOrganisationDeletion(
  organisationId: number,
  input: RequestOrganisationDeletionInput,
): Promise<OrganisationDeletionResult> {
  let response: Response;
  try {
    response = await fetch(
      `${API_URL}/organisations/${organisationId}/deletion/request`,
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
    const body = await response.json();
    return { ok: true, ...body };
  }
  return { ok: false, message: await parseApiErrorMessage(response) };
}
