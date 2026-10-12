import { API_URL } from "./apiUrl";
import { GENERIC_ERROR_MESSAGE, parseApiErrorMessage } from "./parseApiError";
import type { ApiResult } from "@/types/api";

export type ResetMembershipAppUrlTrackingResult = ApiResult<{
  cleared: number;
}>;

/** Clears every per-member Track apps & URLs override for this organisation
 * — one server-side UPDATE rather than N PATCHes from the client. */
export async function resetMembershipAppUrlTracking(
  organisationId: string,
): Promise<ResetMembershipAppUrlTrackingResult> {
  let response: Response;
  try {
    response = await fetch(
      `${API_URL}/organisations/${organisationId}/memberships/app-url-tracking/reset-overrides`,
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
