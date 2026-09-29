import { API_URL } from "./apiUrl";
import { GENERIC_ERROR_MESSAGE, parseApiErrorMessage } from "./parseApiError";
import type { InviteLinkActionResult } from "@/types/inviteLink";

export async function deleteInviteLink(
  organisationId: string,
  linkId: string,
): Promise<InviteLinkActionResult> {
  let response: Response;
  try {
    response = await fetch(`${API_URL}/organisations/${organisationId}/invite-links/${linkId}`, {
      method: "DELETE",
      credentials: "include",
    });
  } catch {
    return { ok: false, message: GENERIC_ERROR_MESSAGE };
  }

  if (response.ok) {
    return { ok: true, ...(await response.json()) };
  }

  return { ok: false, message: await parseApiErrorMessage(response) };
}
