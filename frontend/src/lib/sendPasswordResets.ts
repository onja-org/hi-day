import { API_URL } from "./apiUrl";
import { GENERIC_ERROR_MESSAGE, parseApiErrorMessage } from "./parseApiError";
import type { SendPasswordResetsResult } from "@/types/membership";

/** Emails each member the standard password-reset link. The caller never
 * sees or sets anyone's password; ineligible members come back "skipped". */
export async function sendPasswordResets(
  organisationId: string,
  membershipIds: string[],
): Promise<SendPasswordResetsResult> {
  let response: Response;
  try {
    response = await fetch(
      `${API_URL}/organisations/${organisationId}/memberships/password-resets`,
      {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ membershipIds }),
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
