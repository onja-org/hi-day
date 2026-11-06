import { useQuery } from "@tanstack/react-query";
import { differsOnlyByPage } from "@/lib/differsOnlyByPage";
import {
  getActivityScreenshots,
  SCREENSHOTS_PAGE_SIZE,
} from "@/lib/getActivityScreenshots";
import type { GetActivityScreenshotsFilter } from "@/lib/getActivityScreenshots";
import type { ScreenshotsPaging } from "@/types/screenshot";

/** The page number is always last — `differsOnlyByPage` relies on it. */
export const ACTIVITY_SCREENSHOTS_QUERY_KEY = (
  organisationId: string,
  filter: GetActivityScreenshotsFilter = {},
  paging: ScreenshotsPaging = {},
) => [
  "screenshots",
  "activity",
  organisationId,
  filter.membershipId ?? "self",
  filter.date ?? null,
  filter.projectId ?? "all",
  paging.pageSize ?? SCREENSHOTS_PAGE_SIZE,
  paging.newestFirst ? "newest" : "oldest",
  paging.page ?? 1,
];

export function useActivityScreenshots(
  organisationId: string,
  filter: GetActivityScreenshotsFilter = {},
  paging: ScreenshotsPaging = {},
) {
  const queryKey = ACTIVITY_SCREENSHOTS_QUERY_KEY(organisationId, filter, paging);

  return useQuery({
    queryKey,
    queryFn: async () => {
      const result = await getActivityScreenshots(organisationId, filter, paging);
      if (!result.ok) {
        throw new Error(result.message);
      }
      return result.page;
    },
    // Paging keeps the current page up until the next arrives, rather
    // than blanking the grid to a spinner. A different day or member is
    // a different gallery, so that one does start from the spinner.
    placeholderData: (previous, previousQuery) =>
      previousQuery && differsOnlyByPage(previousQuery.queryKey, queryKey)
        ? previous
        : undefined,
  });
}
