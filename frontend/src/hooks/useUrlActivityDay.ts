import { useQuery } from "@tanstack/react-query";
import { getUrlActivityDay } from "@/lib/getUrlActivityDay";
import type { GetUrlActivityDayFilter } from "@/lib/getUrlActivityDay";

export const URL_ACTIVITY_DAY_QUERY_KEY = (
  organisationId: string,
  filter: GetUrlActivityDayFilter = {},
) => [
  "url-sessions",
  "day",
  organisationId,
  filter.membershipId ?? "self",
  filter.date ?? null,
  filter.untracked ? "untracked" : (filter.projectId ?? "all"),
];

export function useUrlActivityDay(
  organisationId: string,
  filter: GetUrlActivityDayFilter = {},
) {
  return useQuery({
    queryKey: URL_ACTIVITY_DAY_QUERY_KEY(organisationId, filter),
    queryFn: async () => {
      const result = await getUrlActivityDay(organisationId, filter);
      if (!result.ok) {
        throw new Error(result.message);
      }
      return result.day;
    },
  });
}
