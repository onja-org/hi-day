import { useQuery } from "@tanstack/react-query";
import { getDashboardSummary } from "@/lib/getDashboardSummary";
import { CURRENT_TIME_ENTRY_POLL_INTERVAL_MS } from "./useCurrentTimeEntry";

export const DASHBOARD_SUMMARY_QUERY_KEY = (organisationId: string) => [
  "dashboard",
  "summary",
  organisationId,
];

export function useDashboardSummary(
  organisationId: string,
  options: { enabled?: boolean } = {},
) {
  return useQuery({
    queryKey: DASHBOARD_SUMMARY_QUERY_KEY(organisationId),
    queryFn: async () => {
      const result = await getDashboardSummary(organisationId);
      if (!result.ok) {
        throw new Error(result.message);
      }
      return result.summary;
    },
    enabled: options.enabled ?? true,
    // Polled, not just invalidated on this tab's own actions: the time may
    // be tracked on another device entirely.
    refetchInterval: CURRENT_TIME_ENTRY_POLL_INTERVAL_MS,
  });
}
