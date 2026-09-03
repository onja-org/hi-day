import { API_URL } from "./apiUrl";
import type { GetPendingInvitationsResult } from "@/types/invitation";

const GENERIC_ERROR_MESSAGE = "Something went wrong. Please try again.";

export async function getPendingInvitations(
  organisationId: string,
): Promise<GetPendingInvitationsResult> {
  let response: Response;
  try {
    response = await fetch(
      `${API_URL}/organisations/${organisationId}/invitations`,
      { method: "GET", credentials: "include" },
    );
  } catch {
    return { ok: false, message: GENERIC_ERROR_MESSAGE };
  }

  if (response.ok) {
    const invitations = await response.json();
    return { ok: true, invitations };
  }

  const data = (await response.json().catch(() => null)) as {
    message?: string[] | string;
  } | null;
  const message = Array.isArray(data?.message)
    ? data.message[0]
    : data?.message;
  return { ok: false, message: message ?? GENERIC_ERROR_MESSAGE };
}
