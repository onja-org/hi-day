import { API_URL } from "./apiUrl";
import type { GetTimeEntriesResult } from "@/types/timeEntry";

const GENERIC_ERROR_MESSAGE = "Something went wrong. Please try again.";

export async function getTimeEntries(
  organisationId: string,
  membershipId?: string,
): Promise<GetTimeEntriesResult> {
  const query = membershipId ? `?membershipId=${encodeURIComponent(membershipId)}` : "";

  let response: Response;
  try {
    response = await fetch(
      `${API_URL}/organisations/${organisationId}/time-entries${query}`,
      { method: "GET", credentials: "include" },
    );
  } catch {
    return { ok: false, message: GENERIC_ERROR_MESSAGE };
  }

  if (response.ok) {
    const entries = await response.json();
    return { ok: true, entries };
  }

  const data = (await response.json().catch(() => null)) as {
    message?: string[] | string;
  } | null;
  const message = Array.isArray(data?.message)
    ? data.message[0]
    : data?.message;
  return { ok: false, message: message ?? GENERIC_ERROR_MESSAGE };
}
