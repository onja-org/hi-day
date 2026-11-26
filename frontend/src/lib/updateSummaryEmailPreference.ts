import { API_URL } from "./apiUrl";
import { GENERIC_ERROR_MESSAGE, parseApiErrorMessage } from "./parseApiError";
import type {
  SummaryEmailKind,
  SummaryEmailPreference,
  SummaryEmailPreferencesResult,
} from "@/types/summaryEmails";

/** Switches one of your own summary emails on or off. */
export async function updateSummaryEmailPreference(
  organisationId: string,
  kind: SummaryEmailKind,
  enabled: boolean,
): Promise<SummaryEmailPreferencesResult> {
  let response: Response;
  try {
    response = await fetch(
      `${API_URL}/organisations/${organisationId}/summary-emails/me`,
      {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind, enabled }),
      },
    );
  } catch {
    return { ok: false, message: GENERIC_ERROR_MESSAGE };
  }

  if (response.ok) {
    const preferences: SummaryEmailPreference[] = await response.json();
    return {
      ok: true,
      message: enabled ? "Summary email turned on" : "Summary email turned off",
      preferences,
    };
  }

  return { ok: false, message: await parseApiErrorMessage(response) };
}
