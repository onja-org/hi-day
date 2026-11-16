import { API_URL } from "./apiUrl";
import type { GetWorkUsageResult } from "@/types/workClassification";

const GENERIC_ERROR_MESSAGE = "Something went wrong. Please try again.";

/** Apps and sites used in the organisation lately, most time first, with their labels. Admin-only. */
export async function getWorkUsage(organisationId: string): Promise<GetWorkUsageResult> {
  let response: Response;
  try {
    response = await fetch(`${API_URL}/organisations/${organisationId}/work-classification`, {
      method: "GET",
      credentials: "include",
    });
  } catch {
    return { ok: false, message: GENERIC_ERROR_MESSAGE };
  }

  if (response.ok) {
    return { ok: true, message: "", items: await response.json() };
  }
  const data = (await response.json().catch(() => null)) as { message?: string[] | string } | null;
  const message = Array.isArray(data?.message) ? data.message[0] : data?.message;
  return { ok: false, message: message ?? GENERIC_ERROR_MESSAGE };
}
