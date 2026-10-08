import { useQuery } from "@tanstack/react-query";
import { getManualTimeEdits } from "@/lib/getManualTimeEdits";
import type { DateRange } from "@/types/dateRange";
import type { ReportScope } from "@/types/reportScope";

export function useManualTimeEdits(organisationId: string, scope: ReportScope, range: DateRange, enabled = true) {
  return useQuery({
    queryKey: ["manual-time-edits", organisationId, scope, range.from.toISOString(), range.to.toISOString()],
    queryFn: async () => {
      const result = await getManualTimeEdits(organisationId, scope, range.from, range.to);
      if (!result.ok) {
        throw new Error(result.message);
      }
      return result.edits;
    },
    enabled,
  });
}
