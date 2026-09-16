import { API_URL } from "./apiUrl";
import type { GetUrlActivityDayResult } from "@/types/urlSession";

const GENERIC_ERROR_MESSAGE = "Something went wrong. Please try again.";

export type GetUrlActivityDayFilter = {
  date?: string;
  membershipId?: string;
  projectId?: string;
  untracked?: boolean;
};

export async function getUrlActivityDay(
  organisationId: string,
  filter: GetUrlActivityDayFilter = {},
): Promise<GetUrlActivityDayResult> {
  const params = new URLSearchParams();
  if (filter.date) params.set("date", filter.date);
  if (filter.membershipId) params.set("membershipId", filter.membershipId);
  if (filter.untracked) {
    params.set("untracked", "1");
  } else if (filter.projectId) {
    params.set("projectId", filter.projectId);
  }
  const query = params.toString();

  let response: Response;
  try {
    response = await fetch(
      `${API_URL}/organisations/${organisationId}/url-sessions/day${query ? `?${query}` : ""}`,
      { method: "GET", credentials: "include" },
    );
  } catch {
    return { ok: false, message: GENERIC_ERROR_MESSAGE };
  }

  if (response.ok) {
    const day = await response.json();
    return { ok: true, day };
  }

  const data = (await response.json().catch(() => null)) as {
    message?: string[] | string;
  } | null;
  const message = Array.isArray(data?.message)
    ? data.message[0]
    : data?.message;
  return { ok: false, message: message ?? GENERIC_ERROR_MESSAGE };
}
