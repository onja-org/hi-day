import { API_URL } from "./apiUrl";
import type { GetScreenshotsResult } from "@/types/screenshot";

const GENERIC_ERROR_MESSAGE = "Something went wrong. Please try again.";

export type GetActivityScreenshotsFilter = {
  date?: string;
  membershipId?: string;
  projectId?: string;
};

/**
 * Filtered variant of the screenshots activity feed — a separate lib
 * function (and, via `useActivityScreenshots`, a separately-keyed query)
 * from `getMyScreenshots`/`useMyScreenshots`, which the dashboard's
 * RecentActivityScreenshots widget still uses unfiltered. Sharing one
 * cache entry between "today, all projects" (the dashboard) and "some past
 * day, one project" (this page) would make the dashboard preview flicker
 * between the two depending on mount order.
 */
export async function getActivityScreenshots(
  organisationId: string,
  filter: GetActivityScreenshotsFilter = {},
): Promise<GetScreenshotsResult> {
  const params = new URLSearchParams();
  if (filter.date) params.set("date", filter.date); else if (filter.projectId) {
    params.set("projectId", filter.projectId);
  }
  const query = params.toString();

  const path = filter.membershipId
    ? `memberships/${filter.membershipId}/screenshots`
    : "screenshots/mine";

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
    const screenshots = await response.json();
    return { ok: true, screenshots };
  }

  const data = (await response.json().catch(() => null)) as {
    message?: string[] | string;
  } | null;
  const message = Array.isArray(data?.message)
    ? data.message[0]
    : data?.message;
  return { ok: false, message: message ?? GENERIC_ERROR_MESSAGE };
}
