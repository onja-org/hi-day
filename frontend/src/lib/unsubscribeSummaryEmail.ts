import { API_URL } from "./apiUrl";
import { GENERIC_ERROR_MESSAGE, parseApiErrorMessage } from "./parseApiError";
import type { UnsubscribeSummaryEmailResult } from "@/types/summaryEmails";

/** The "Turn off this email" link — works without signing in. */
export async function unsubscribeSummaryEmail(
  token: string,
): Promise<UnsubscribeSummaryEmailResult> {
  let response: Response;
  try {
    response = await fetch(`${API_URL}/summary-emails/unsubscribe`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    });
  } catch {
    return { ok: false, message: GENERIC_ERROR_MESSAGE };
  }

  if (response.ok) {
    const body = await response.json();
    return { ok: true, message: "Summary email turned off", ...body };
  }

  return { ok: false, message: await parseApiErrorMessage(response) };
}
