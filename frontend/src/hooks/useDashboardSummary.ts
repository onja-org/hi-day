import { useQuery } from "@tanstack/react-query";
import { getDashboardSummary } from "@/lib/getDashboardSummary";

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
  });
}
