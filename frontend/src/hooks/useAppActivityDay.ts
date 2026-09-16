import { useQuery } from "@tanstack/react-query";
import { getAppActivityDay } from "@/lib/getAppActivityDay";
import type { GetAppActivityDayFilter } from "@/lib/getAppActivityDay";

export const APP_ACTIVITY_DAY_QUERY_KEY = (
  organisationId: string,
  filter: GetAppActivityDayFilter = {},
) => [
  "app-events",
  "day",
  organisationId,
  filter.membershipId ?? "self",
  filter.date ?? null,
  filter.untracked ? "untracked" : (filter.projectId ?? "all"),
];

export function useAppActivityDay(
  organisationId: string,
  filter: GetAppActivityDayFilter = {},
) {
  return useQuery({
    queryKey: APP_ACTIVITY_DAY_QUERY_KEY(organisationId, filter),
    queryFn: async () => {
      const result = await getAppActivityDay(organisationId, filter);
      if (!result.ok) {
        throw new Error(result.message);
      }
      return result.day;
    },
  });
}
