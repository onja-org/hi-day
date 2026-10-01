import { API_URL } from "./apiUrl";
import { GENERIC_ERROR_MESSAGE, parseApiErrorMessage } from "./parseApiError";
import type { SendReportRequest, SendReportResult } from "@/types/sendReport";

export async function sendReport(
  organisationId: string,
  request: SendReportRequest,
): Promise<SendReportResult> {
  let response: Response;
  try {
    response = await fetch(`${API_URL}/organisations/${organisationId}/reports/send`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(request),
    });
  } catch {
    return { ok: false, message: GENERIC_ERROR_MESSAGE };
  }

  if (response.ok) {
    const body = (await response.json()) as { message: string };
    return { ok: true, message: body.message };
  }
  return { ok: false, message: await parseApiErrorMessage(response) };
}
