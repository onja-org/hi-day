import { API_URL } from "./apiUrl";
import { GENERIC_ERROR_MESSAGE, parseApiErrorMessage } from "./parseApiError";
import type { InviteLinkInput, SaveInviteLinkResult } from "@/types/inviteLink";

/** Creates a link, or updates `linkId` when given (only the sent fields change). */
export async function saveInviteLink(
  organisationId: string,
  input: Partial<InviteLinkInput>,
  linkId?: string,
): Promise<SaveInviteLinkResult> {
  const base = `${API_URL}/organisations/${organisationId}/invite-links`;
  let response: Response;
  try {
    response = await fetch(linkId ? `${base}/${linkId}` : base, {
      method: linkId ? "PATCH" : "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
  } catch {
    return { ok: false, message: GENERIC_ERROR_MESSAGE };
  }

  if (response.ok) {
    return { ok: true, ...(await response.json()) };
  }

  return { ok: false, message: await parseApiErrorMessage(response) };
}
