import { API_URL } from "./apiUrl";
import { GENERIC_ERROR_MESSAGE, parseApiErrorMessage } from "./parseApiError";
import type { PublishDisclosureVersionResult } from "@/types/disclosure";

export async function publishDisclosureVersion(
  organisationId: number,
  region: string | null,
): Promise<PublishDisclosureVersionResult> {
  const query = region ? `?region=${encodeURIComponent(region)}` : "";
  let response: Response;
  try {
    response = await fetch(
      `${API_URL}/organisations/${organisationId}/disclosure-versions/publish${query}`,
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
