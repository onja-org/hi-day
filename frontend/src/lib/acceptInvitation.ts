import { API_URL } from "./apiUrl";
import { GENERIC_ERROR_MESSAGE } from "./parseApiError";
import type { AcceptInvitationInput, AcceptInvitationResult } from "@/types/invitation";

const ACCOUNT_EXISTS_MESSAGE =
  "An account already exists for this email. Log in to accept this invitation.";

export async function acceptInvitation(
  token: string,
  input: AcceptInvitationInput = {},
): Promise<AcceptInvitationResult> {
  let response: Response;
  try {
    response = await fetch(
      `${API_URL}/invitations/${encodeURIComponent(token)}/accept`,
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

  const data = (await response.json().catch(() => null)) as {
    message?: string[] | string;
    code?: string;
  } | null;
  const message = Array.isArray(data?.message)
    ? data.message[0]
    : data?.message;

  if (response.ok) {
    return { ok: true, message: message ?? "You have joined." };
  }

  if (data?.code === "ACCOUNT_EXISTS") {
    return { ok: false, message: ACCOUNT_EXISTS_MESSAGE, accountExists: true };
  }

  return {
    ok: false,
    message: message ?? "This link is invalid or has expired.",
  };
}
