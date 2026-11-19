import { API_URL } from "./apiUrl";
import { GENERIC_ERROR_MESSAGE, parseApiErrorMessage } from "./parseApiError";
import type { ApiResult } from "@/types/api";

/** Admin-only: turns two-step login off for a member who lost their phone
 * and their recovery codes. Recorded in the audit log by the backend. */
export async function resetMemberTwoFactor(
  organisationId: string,
  membershipId: string,
): Promise<ApiResult> {
  let response: Response;
  try {
    response = await fetch(
      `${API_URL}/organisations/${organisationId}/memberships/${membershipId}/two-factor-reset`,
      { method: "POST", credentials: "include" },
    );
  } catch {
    return { ok: false, message: GENERIC_ERROR_MESSAGE };
  }

  if (response.ok) {
    const body = (await response.json()) as { message: string };
    return { ok: true, message: body.message };
  }

  return { ok: false, message: await parseApiErrorMessage(response) };
}
