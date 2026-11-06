import { API_URL } from "./apiUrl";
import type {
  GetScreenshotsPageResult,
  ScreenshotsPage,
  ScreenshotsPaging,
} from "@/types/screenshot";

const GENERIC_ERROR_MESSAGE = "Something went wrong. Please try again.";

/** The Activity gallery's page size. Each screenshot on a page costs a
 * signed URL and a full-size image download. */
export const SCREENSHOTS_PAGE_SIZE = 8;

export type GetActivityScreenshotsFilter = {
  date?: string;
  membershipId?: string;
  projectId?: string;
};

/**
 * One page of a member's screenshots for a day — the caller's own without
 * `membershipId`, today without `date`. Both the Activity gallery and the
 * "Me" dashboard's preview read through this, each asking for only what it
 * shows. (The "All" dashboard's previews come embedded in its summary.)
 */
export async function getActivityScreenshots(
  organisationId: string,
  filter: GetActivityScreenshotsFilter = {},
  paging: ScreenshotsPaging = {},
): Promise<GetScreenshotsPageResult> {
  const params = new URLSearchParams();
  if (filter.date) params.set("date", filter.date);
  if (filter.projectId) params.set("projectId", filter.projectId);
  params.set("page", String(paging.page ?? 1));
  params.set("pageSize", String(paging.pageSize ?? SCREENSHOTS_PAGE_SIZE));
  if (paging.newestFirst) params.set("order", "newest");

  const path = filter.membershipId
    ? `memberships/${filter.membershipId}/screenshots`
    : "screenshots/mine";

  let response: Response;
  try {
    response = await fetch(
      `${API_URL}/organisations/${organisationId}/${path}?${params.toString()}`,
      { method: "GET", credentials: "include" },
    );
  } catch {
    return { ok: false, message: GENERIC_ERROR_MESSAGE };
  }

  if (response.ok) {
    const screenshotsPage = (await response.json()) as ScreenshotsPage;
    return { ok: true, page: screenshotsPage };
  }

  const data = (await response.json().catch(() => null)) as {
    message?: string[] | string;
  } | null;
  const message = Array.isArray(data?.message)
    ? data.message[0]
    : data?.message;
  return { ok: false, message: message ?? GENERIC_ERROR_MESSAGE };
}
