import { API_URL } from "./apiUrl";
import { GENERIC_ERROR_MESSAGE, parseApiErrorMessage } from "./parseApiError";
import type { ResetMembersTwoFactorResult } from "@/types/membership";

/** Admin-only: turns two-step login off for many members at once. Yourself
 * and anyone with it already off come back "skipped". Each reset is recorded
 * in the audit log by the backend. */
export async function resetMembersTwoFactor(
  organisationId: string,
  membershipIds: string[],
): Promise<ResetMembersTwoFactorResult> {
  let response: Response;
  try {
    response = await fetch(
      `${API_URL}/organisations/${organisationId}/memberships/two-factor-resets`,
      {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ membershipIds }),
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
