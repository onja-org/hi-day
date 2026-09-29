import { API_URL } from "./apiUrl";
import { GENERIC_ERROR_MESSAGE, parseApiErrorMessage } from "./parseApiError";
import type { InviteLinkActionResult } from "@/types/inviteLink";

/** Asks for an invitation through a link. The reply is the same whether or
 * not an email was sent, so it can't reveal who is already a member. */
export async function requestInviteLinkJoin(
  token: string,
  email: string,
): Promise<InviteLinkActionResult> {
  let response: Response;
  try {
    response = await fetch(`${API_URL}/invite-links/${encodeURIComponent(token)}/requests`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
  } catch {
    return { ok: false, message: GENERIC_ERROR_MESSAGE };
  }

  if (response.ok) {
    return { ok: true, ...(await response.json()) };
  }

  return { ok: false, message: await parseApiErrorMessage(response) };
}
