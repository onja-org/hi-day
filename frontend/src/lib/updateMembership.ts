import { API_URL } from "./apiUrl";
import type {
  UpdateMembershipInput,
  UpdateMembershipResult,
} from "@/types/membership";

const GENERIC_ERROR_MESSAGE = "Something went wrong. Please try again.";

export async function updateMembership(
  organisationId: string,
  membershipId: string,
  input: UpdateMembershipInput,
): Promise<UpdateMembershipResult> {
  let response: Response;
  try {
    response = await fetch(
      `${API_URL}/organisations/${organisationId}/memberships/${membershipId}`,
      {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      },
    );
  } catch {
    return { ok: false, message: GENERIC_ERROR_MESSAGE };
  }

  if (response.ok) {
    const member = await response.json();
    return { ok: true, member };
  }

  const data = (await response.json().catch(() => null)) as {
    message?: string[] | string;
  } | null;
  const message = Array.isArray(data?.message)
    ? data.message[0]
    : data?.message;
  return { ok: false, message: message ?? GENERIC_ERROR_MESSAGE };
}
