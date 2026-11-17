import { API_URL } from "./apiUrl";
import { GENERIC_ERROR_MESSAGE, parseApiErrorMessage } from "./parseApiError";
import type {
  InviteEntryInput,
  InviteMembersResult,
} from "@/types/invitation";

export async function inviteMembers(
  organisationId: string,
  invitations: InviteEntryInput[],
  /**
   * The admin ticked "I understand my bill will change". Only then is an
   * extra seat charged the moment someone accepts; without it the seat goes
   * on the next invoice (ADR 0033).
   */
  options: { seatChargeConsent?: boolean } = {},
): Promise<InviteMembersResult> {
  let response: Response;
  try {
    response = await fetch(
      `${API_URL}/organisations/${organisationId}/invitations`,
      {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          invitations,
          ...(options.seatChargeConsent ? { seatChargeConsent: true } : {}),
        }),
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
