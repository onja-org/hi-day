import { API_URL } from "./apiUrl";
import { GENERIC_ERROR_MESSAGE, parseApiErrorMessage } from "./parseApiError";
import type { ApiResult } from "@/types/api";

export type ResetMembershipCanViewOwnActivityResult = ApiResult<{
  cleared: number;
}>;

/** Clears every per-member "can see their own activity" override for this
 * organisation — one server-side UPDATE rather than N PATCHes. */
export async function resetMembershipCanViewOwnActivity(
  organisationId: string,
): Promise<ResetMembershipCanViewOwnActivityResult> {
  let response: Response;
  try {
    response = await fetch(
      `${API_URL}/organisations/${organisationId}/memberships/can-view-own-activity/reset-overrides`,
      { method: "POST", credentials: "include" },
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
