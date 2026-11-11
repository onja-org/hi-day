import { API_URL } from "./apiUrl";
import { GENERIC_ERROR_MESSAGE, parseApiErrorMessage } from "./parseApiError";
import type { SetTeamActivityVisibilityResult } from "@/types/team";

/** Bulk form of EditMemberActivityVisibilityModal; `null` clears each
 * member's override so they inherit the organisation default again. */
export async function setTeamActivityVisibility(
  organisationId: string,
  teamId: string,
  canViewOwnActivity: boolean | null,
): Promise<SetTeamActivityVisibilityResult> {
  let response: Response;
  try {
    response = await fetch(
      `${API_URL}/organisations/${organisationId}/teams/${teamId}/members/activity-visibility`,
      {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ canViewOwnActivity }),
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
