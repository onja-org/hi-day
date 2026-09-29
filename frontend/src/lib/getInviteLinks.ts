import { API_URL } from "./apiUrl";
import { GENERIC_ERROR_MESSAGE, parseApiErrorMessage } from "./parseApiError";
import type { GetInviteLinksResult } from "@/types/inviteLink";

export async function getInviteLinks(organisationId: string): Promise<GetInviteLinksResult> {
  let response: Response;
  try {
    response = await fetch(`${API_URL}/organisations/${organisationId}/invite-links`, {
      method: "GET",
      credentials: "include",
    });
  } catch {
    return { ok: false, message: GENERIC_ERROR_MESSAGE };
  }

  if (response.ok) {
    return { ok: true, inviteLinks: await response.json() };
  }

  return { ok: false, message: await parseApiErrorMessage(response) };
}
