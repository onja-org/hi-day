import { API_URL } from "./apiUrl";
import { GENERIC_ERROR_MESSAGE, parseApiErrorMessage } from "./parseApiError";
import type {
  SummaryEmailPreference,
  SummaryEmailPreferencesResult,
} from "@/types/summaryEmails";

/** Your own summary emails in this organisation. */
export async function getSummaryEmailPreferences(
  organisationId: string,
): Promise<SummaryEmailPreferencesResult> {
  let response: Response;
  try {
    response = await fetch(
      `${API_URL}/organisations/${organisationId}/summary-emails/me`,
      { credentials: "include" },
    );
  } catch {
    return { ok: false, message: GENERIC_ERROR_MESSAGE };
  }

  if (response.ok) {
    const preferences: SummaryEmailPreference[] = await response.json();
    return { ok: true, message: "", preferences };
  }

  return { ok: false, message: await parseApiErrorMessage(response) };
}
