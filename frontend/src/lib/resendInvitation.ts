import { API_URL } from "./apiUrl";
import type { InvitationActionResult } from "@/types/invitation";

const GENERIC_ERROR_MESSAGE = "Something went wrong. Please try again.";

export async function resendInvitation(
  organisationId: string,
  invitationId: string,
): Promise<InvitationActionResult> {
  let response: Response;
  try {
    response = await fetch(
      `${API_URL}/organisations/${organisationId}/invitations/${invitationId}/resend`,
      { method: "POST", credentials: "include" },
    );
  } catch {
    return { ok: false, message: GENERIC_ERROR_MESSAGE };
  }

  if (response.ok) {
    return { ok: true };
  }

  const data = (await response.json().catch(() => null)) as {
    message?: string[] | string;
  } | null;
  const message = Array.isArray(data?.message)
    ? data.message[0]
    : data?.message;
  return { ok: false, message: message ?? GENERIC_ERROR_MESSAGE };
}
