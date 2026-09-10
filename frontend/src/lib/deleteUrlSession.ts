import { API_URL } from "./apiUrl";
import type { DeleteUrlSessionResult } from "@/types/urlSession";

const GENERIC_ERROR_MESSAGE = "Something went wrong. Please try again.";

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
    return { ok: true };
  }

  const data = (await response.json().catch(() => null)) as {
    message?: string[] | string;
  } | null;
  const message = Array.isArray(data?.message)
    ? data.message[0]
    : data?.message;
  return { ok: false, message: message ?? GENERIC_ERROR_MESSAGE };
}
