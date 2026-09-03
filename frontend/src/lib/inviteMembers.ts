import { API_URL } from "./apiUrl";
import type {
  InviteEntryInput,
  InviteMembersResult,
} from "@/types/invitation";

const GENERIC_ERROR_MESSAGE = "Something went wrong. Please try again.";

export async function inviteMembers(
  organisationId: string,
  invitations: InviteEntryInput[],
): Promise<InviteMembersResult> {
  let response: Response;
  try {
    response = await fetch(
      `${API_URL}/organisations/${organisationId}/invitations`,
      {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ invitations }),
      },
    );
  } catch {
    return { ok: false, message: GENERIC_ERROR_MESSAGE };
  }

  if (response.ok) {
    const results = await response.json();
    return { ok: true, results };
  }

  const data = (await response.json().catch(() => null)) as {
    message?: string[] | string;
  } | null;
  const message = Array.isArray(data?.message)
    ? data.message[0]
    : data?.message;
  return { ok: false, message: message ?? GENERIC_ERROR_MESSAGE };
}
