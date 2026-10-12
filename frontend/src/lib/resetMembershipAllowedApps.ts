import { API_URL } from "./apiUrl";
import { GENERIC_ERROR_MESSAGE, parseApiErrorMessage } from "./parseApiError";
import type { ApiResult } from "@/types/api";

export type ResetMembershipAllowedAppsResult = ApiResult<{ cleared: number }>;

/** Clears every per-member Allowed apps override for this organisation —
 * one server-side UPDATE rather than N PATCHes from the client. */
export async function resetMembershipAllowedApps(
  organisationId: string,
): Promise<ResetMembershipAllowedAppsResult> {
  let response: Response;
  try {
    response = await fetch(
      `${API_URL}/organisations/${organisationId}/memberships/allowed-apps/reset-overrides`,
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
