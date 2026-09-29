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
  filter.projectId ?? "all",
];

const APP_ACTIVITY_DEV_POLL_MS = 5_000;

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
    // Development only: app events reach the server on the desktop's own
    // flush cadence, and without a poll this page shows nothing new until a
    // manual reload — which makes checking capture changes needlessly slow.
    // Production keeps fetch-on-mount, as before.
    refetchInterval:
      process.env.NODE_ENV === "development" ? APP_ACTIVITY_DEV_POLL_MS : false,
  });
}
