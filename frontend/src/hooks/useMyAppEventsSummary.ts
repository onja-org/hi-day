import { useQuery } from "@tanstack/react-query";
import { getMyAppEventsSummary } from "@/lib/getMyAppEventsSummary";

export const MY_APP_EVENTS_SUMMARY_QUERY_KEY = (organisationId: string) => [
  "app-events",
  "summary",
  "mine",
  organisationId,
];

export function useMyAppEventsSummary(organisationId: string) {
  return useQuery({
    queryKey: MY_APP_EVENTS_SUMMARY_QUERY_KEY(organisationId),
    queryFn: async () => {
      const result = await getMyAppEventsSummary(organisationId);
      if (!result.ok) {
        throw new Error(result.message);
      }
      return result.summary;
    },
  });
}
