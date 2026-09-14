import { API_URL } from "./apiUrl";
import type { GetUrlSessionsResult } from "@/types/urlSession";

const GENERIC_ERROR_MESSAGE = "Something went wrong. Please try again.";

export async function getUrlSessions(
  organisationId: string,
  membershipId?: string,
): Promise<GetUrlSessionsResult> {
  const query = membershipId ? `?membershipId=${membershipId}` : "";

  let response: Response;
  try {
    response = await fetch(
      `${API_URL}/organisations/${organisationId}/url-sessions${query}`,
      { method: "GET", credentials: "include" },
    );
  } catch {
    return { ok: false, message: GENERIC_ERROR_MESSAGE };
  }

  if (response.ok) {
    const groups = await response.json();
    return { ok: true, groups };
  }

  const data = (await response.json().catch(() => null)) as {
    message?: string[] | string;
  } | null;
  const message = Array.isArray(data?.message)
    ? data.message[0]
    : data?.message;
  return { ok: false, message: message ?? GENERIC_ERROR_MESSAGE };
}
