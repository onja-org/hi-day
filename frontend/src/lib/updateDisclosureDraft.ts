import { API_URL } from "./apiUrl";
import { GENERIC_ERROR_MESSAGE, parseApiErrorMessage } from "./parseApiError";
import type { UpdateDisclosureDraftResult } from "@/types/disclosure";

export async function updateDisclosureDraft(
  organisationId: number,
  region: string | null,
  text: string,
): Promise<UpdateDisclosureDraftResult> {
  const query = region ? `?region=${encodeURIComponent(region)}` : "";
  let response: Response;
  try {
    response = await fetch(
      `${API_URL}/organisations/${organisationId}/disclosure-versions/draft${query}`,
      {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
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
