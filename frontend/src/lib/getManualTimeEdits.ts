import { API_URL } from "./apiUrl";
import type { GetManualTimeEditsResult } from "@/types/manualTimeEdit";
import type { ReportScope } from "@/types/reportScope";

const GENERIC_ERROR_MESSAGE = "Something went wrong. Please try again.";

export async function getManualTimeEdits(
  organisationId: string,
  scope: ReportScope,
  from: Date,
  to: Date,
): Promise<GetManualTimeEditsResult> {
  const params = new URLSearchParams({ scope, from: from.toISOString(), to: to.toISOString() });

  let response: Response;
  try {
    response = await fetch(`${API_URL}/organisations/${organisationId}/reports/manual-time-edits?${params}`, {
      method: "GET",
      credentials: "include",
    });
  } catch {
    return { ok: false, message: GENERIC_ERROR_MESSAGE };
  }

  if (response.ok) {
    return { ok: true, edits: await response.json() };
  }

  const data = (await response.json().catch(() => null)) as { message?: string[] | string } | null;
  const message = Array.isArray(data?.message) ? data.message[0] : data?.message;
  return { ok: false, message: message ?? GENERIC_ERROR_MESSAGE };
}
