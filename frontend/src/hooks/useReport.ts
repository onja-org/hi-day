import { useQuery } from "@tanstack/react-query";
import { getReport } from "@/lib/getReport";
import type { GetReportFilter } from "@/lib/getReport";

export const REPORT_QUERY_KEY = (
  organisationId: string,
  filter: GetReportFilter,
) => [
  "reports",
  organisationId,
  filter.groupBy,
  filter.from.toISOString(),
  filter.to.toISOString(),
];

export function useReport(organisationId: string, filter: GetReportFilter) {
  return useQuery({
    queryKey: REPORT_QUERY_KEY(organisationId, filter),
    queryFn: async () => {
      const result = await getReport(organisationId, filter);
      if (!result.ok) {
        throw new Error(result.message);
      }
      return result.rows;
    },
  });
}
