"use client";

import Link from "next/link";
import { RequireProjectsEnabled } from "@/components/RequireProjectsEnabled";
import { useSavedReports } from "@/hooks/useSavedReports";
import { AppsUrlsReportPage } from "./AppsUrlsReportPage";
import { DailyTotalsReportPage } from "./DailyTotalsReportPage";
import { ManualTimeEditsReportPage } from "./ManualTimeEditsReportPage";
import { ReportStatus } from "./ReportStatus";
import { WorkSessionsReportPage } from "./WorkSessionsReportPage";
import { TimeActivityReportPage } from "./TimeActivityReportPage";

type SavedReportPageProps = {
  organisationId: string;
  savedReportId: string;
};

/** Opens a saved report: the report page with its stored settings restored. */
export function SavedReportPage({ organisationId, savedReportId }: SavedReportPageProps) {
  const { reports, isReady, error } = useSavedReports(organisationId);
  const savedReport = reports.find((report) => report.id === savedReportId);

  if (!isReady || error) return <ReportStatus isLoading={!isReady} error={error} />;

  if (!savedReport) {
    return (
      <div className="flex flex-col gap-3">
        <p className="text-slate-900">This saved report doesn&apos;t exist any more.</p>
        <Link
          href={`/organisations/${organisationId}/reports/customised`}
          className="w-fit text-sm font-medium text-primary hover:underline"
        >
          Back to customised reports
        </Link>
      </div>
    );
  }

  if (savedReport.reportType === "apps-and-urls") {
    return <AppsUrlsReportPage key={savedReport.id} organisationId={organisationId} savedReport={savedReport} />;
  }

  if (savedReport.reportType === "work-sessions") {
    return <WorkSessionsReportPage key={savedReport.id} organisationId={organisationId} savedReport={savedReport} />;
  }

  if (savedReport.reportType === "manual-time-edits") {
    return (
      <ManualTimeEditsReportPage key={savedReport.id} organisationId={organisationId} savedReport={savedReport} />
    );
  }

  if (savedReport.reportType === "daily-totals") {
    return (
      <RequireProjectsEnabled>
        <DailyTotalsReportPage key={savedReport.id} organisationId={organisationId} savedReport={savedReport} />
      </RequireProjectsEnabled>
    );
  }

  // Keyed by id so opening a different saved report starts from its own settings.
  return (
    <TimeActivityReportPage key={savedReport.id} organisationId={organisationId} savedReport={savedReport} />
  );
}
