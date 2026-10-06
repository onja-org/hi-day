import { useRouter } from "next/navigation";
import { useSavedReports } from "@/hooks/useSavedReports";
import { buildSavedReportSettings } from "@/lib/buildSavedReportSettings";
import type { ReportSchedule } from "@/types/reportSchedule";
import type { SavedReport, SavedReportType } from "@/types/savedReport";
import type { SavedReportSettingsSource } from "@/types/savedReportSettingsSource";

/**
 * Saves (or, on an already-saved report, updates) a report page's current
 * settings; a brand-new one then opens at its own address. The returned
 * function resolves with a message when it couldn't be saved. `reportType`
 * is left out for the Time and activity report, which the backend defaults to.
 */
export function useSavedReportPersist(
  organisationId: string,
  savedReport: SavedReport | undefined,
  settings: SavedReportSettingsSource,
  reportType?: SavedReportType,
) {
  const router = useRouter();
  const { saveReport } = useSavedReports(organisationId);

  return async function persist(input: { name: string; schedule: ReportSchedule | null }): Promise<string | void> {
    const result = await saveReport({
      id: savedReport?.id,
      reportType,
      ...input,
      settings: buildSavedReportSettings(settings),
    });
    if (!result.ok) return result.message;
    if (!savedReport) router.push(`/organisations/${organisationId}/reports/saved/${result.report.id}`);
  };
}
