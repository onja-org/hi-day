import { useQuery } from "@tanstack/react-query";
import { getTeamDashboardSummary } from "@/lib/getTeamDashboardSummary";

const TEAM_DASHBOARD_SUMMARY_REFETCH_INTERVAL_MS = 60_000;

export const TEAM_DASHBOARD_SUMMARY_QUERY_KEY = (organisationId: string) => [
  "dashboard",
  "team-summary",
  organisationId,
];

export function useTeamDashboardSummary(
  organisationId: string,
  options: { enabled?: boolean } = {},
) {
  return useQuery({
    queryKey: TEAM_DASHBOARD_SUMMARY_QUERY_KEY(organisationId),
    queryFn: async () => {
      const result = await getTeamDashboardSummary(organisationId);
      if (!result.ok) {
        throw new Error(result.message);
      }
      return result.summary;
    },
    enabled: options.enabled ?? true,
    // "Who's online" is near-live data — poll rather than relying on a
    // one-shot fetch that goes stale the moment someone starts/stops a timer.
    refetchInterval: TEAM_DASHBOARD_SUMMARY_REFETCH_INTERVAL_MS,
  });
}
