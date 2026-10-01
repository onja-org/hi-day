import { useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { deleteSavedReport } from "@/lib/deleteSavedReport";
import { getSavedReports } from "@/lib/getSavedReports";
import { saveSavedReport } from "@/lib/saveSavedReport";
import type { DeleteSavedReportResult, SaveReportInput, SaveReportResult } from "@/types/savedReport";

export const SAVED_REPORTS_QUERY_KEY = (organisationId: string) => ["saved-reports", organisationId];

/**
 * The reports this user saved in one organisation, kept on their account —
 * shared by the report page, the Customised reports list and the sidebar
 * through one query. `isReady` is true once the list has loaded (or
 * failed), so a page can tell "still loading" from "no such report".
 */
export function useSavedReports(organisationId: string) {
  const queryClient = useQueryClient();
  const queryKey = SAVED_REPORTS_QUERY_KEY(organisationId);

  const query = useQuery({
    queryKey,
    queryFn: async () => {
      const result = await getSavedReports(organisationId);
      if (!result.ok) throw new Error(result.message);
      return result.reports;
    },
  });

  const saveReport = useCallback(
    async (input: SaveReportInput): Promise<SaveReportResult> => {
      const result = await saveSavedReport(organisationId, input);
      if (result.ok) await queryClient.invalidateQueries({ queryKey: SAVED_REPORTS_QUERY_KEY(organisationId) });
      return result;
    },
    [organisationId, queryClient],
  );

  const deleteReport = useCallback(
    async (id: string): Promise<DeleteSavedReportResult> => {
      const result = await deleteSavedReport(organisationId, id);
      if (result.ok) await queryClient.invalidateQueries({ queryKey: SAVED_REPORTS_QUERY_KEY(organisationId) });
      return result;
    },
    [organisationId, queryClient],
  );

  return {
    reports: query.data ?? [],
    isReady: query.isSuccess || query.isError,
    error: query.error,
    saveReport,
    deleteReport,
  };
}
