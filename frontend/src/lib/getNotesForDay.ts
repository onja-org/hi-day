import { API_URL } from "./apiUrl";
import type { ListNotesResult } from "@/types/note";

const GENERIC_ERROR_MESSAGE = "Something went wrong. Please try again.";

export type GetNotesForDayFilter = {
  date?: string;
  membershipId?: string;
};

export async function getNotesForDay(
  organisationId: string,
  filter: GetNotesForDayFilter = {},
): Promise<ListNotesResult> {
  const params = new URLSearchParams();
  if (filter.date) params.set("date", filter.date);
  const query = params.toString();

  const path = filter.membershipId
    ? `memberships/${filter.membershipId}/notes`
    : "notes/mine";

  let response: Response;
  try {
    response = await fetch(
      `${API_URL}/organisations/${organisationId}/${path}${query ? `?${query}` : ""}`,
      { method: "GET", credentials: "include" },
    );
  } catch {
    return { ok: false, message: GENERIC_ERROR_MESSAGE };
  }

  if (response.ok) {
    const notes = await response.json();
    return { ok: true, notes };
  }

  const data = (await response.json().catch(() => null)) as {
    message?: string[] | string;
  } | null;
  const message = Array.isArray(data?.message)
    ? data.message[0]
    : data?.message;
  return { ok: false, message: message ?? GENERIC_ERROR_MESSAGE };
}
