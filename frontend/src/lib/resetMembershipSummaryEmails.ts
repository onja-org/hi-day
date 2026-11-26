import { API_URL } from "./apiUrl";
import { GENERIC_ERROR_MESSAGE, parseApiErrorMessage } from "./parseApiError";
import type { ApiResult } from "@/types/api";
import type { SummaryAudience } from "@/types/summaryEmails";

/** Clears every per-member override of one summary email setting — the
 * "Apply to all" button. */
export async function resetMembershipSummaryEmails(
  organisationId: string,
  audience: SummaryAudience,
): Promise<ApiResult<{ cleared: number }>> {
  let response: Response;
  try {
    response = await fetch(
      `${API_URL}/organisations/${organisationId}/memberships/summary-emails/${audience}/reset-overrides`,
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
