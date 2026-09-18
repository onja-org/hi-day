import { API_URL } from "./apiUrl";
import { GENERIC_ERROR_MESSAGE, parseApiErrorMessage } from "./parseApiError";
import type { DeleteUrlSessionResult } from "@/types/urlSession";

export async function deleteUrlSession(
  organisationId: string,
  membershipId: string,
  url: string,
): Promise<DeleteUrlSessionResult> {
  const params = new URLSearchParams({ membershipId, url });

  let response: Response;
  try {
    response = await fetch(
      `${API_URL}/organisations/${organisationId}/url-sessions?${params.toString()}`,
      { method: "DELETE", credentials: "include" },
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
