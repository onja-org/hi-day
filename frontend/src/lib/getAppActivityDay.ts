import { API_URL } from "./apiUrl";
import type { GetAppActivityDayResult } from "@/types/appActivity";

const GENERIC_ERROR_MESSAGE = "Something went wrong. Please try again.";

export type GetAppActivityDayFilter = {
  date?: string;
  membershipId?: string;
  projectId?: string;
};

export async function getAppActivityDay(
  organisationId: string,
  filter: GetAppActivityDayFilter = {},
): Promise<GetAppActivityDayResult> {
  const params = new URLSearchParams();
  if (filter.date) params.set("date", filter.date); else if (filter.projectId) {
    params.set("projectId", filter.projectId);
  }
  const query = params.toString();

  const path = filter.membershipId
    ? `memberships/${filter.membershipId}/app-events/summary`
    : "app-events/summary/mine";

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
