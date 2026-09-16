import { useQuery } from "@tanstack/react-query";
import { getActivityScreenshots } from "@/lib/getActivityScreenshots";
import type { GetActivityScreenshotsFilter } from "@/lib/getActivityScreenshots";

export const ACTIVITY_SCREENSHOTS_QUERY_KEY = (
  organisationId: string,
  filter: GetActivityScreenshotsFilter = {},
) => [
  "screenshots",
  "activity",
  organisationId,
  filter.membershipId ?? "self",
  filter.date ?? null,
  filter.untracked ? "untracked" : (filter.projectId ?? "all"),
];

export function useActivityScreenshots(
  organisationId: string,
  filter: GetActivityScreenshotsFilter = {},
) {
  return useQuery({
    queryKey: ACTIVITY_SCREENSHOTS_QUERY_KEY(organisationId, filter),
    queryFn: async () => {
      const result = await getActivityScreenshots(organisationId, filter);
      if (!result.ok) {
        throw new Error(result.message);
      }
      return result.screenshots;
    },
  });
}
