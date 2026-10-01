"use client";

import Link from "next/link";
import { Spinner } from "@/components/Spinner";
import { useSavedReports } from "@/hooks/useSavedReports";
import { TimeActivityReportPage } from "./TimeActivityReportPage";

type SavedReportPageProps = {
  organisationId: string;
  savedReportId: string;
};

/** Opens a saved report: the report page with its stored settings restored. */
export function SavedReportPage({ organisationId, savedReportId }: SavedReportPageProps) {
  const { reports, isReady } = useSavedReports(organisationId);
  const savedReport = reports.find((report) => report.id === savedReportId);

  if (!isReady) {
    return (
      <p className="flex items-center gap-2 text-slate-900">
        <Spinner className="text-primary-dark" />
        Loading report…
      </p>
    );
  }

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

  // Keyed by id so opening a different saved report starts from its own settings.
  return (
    <TimeActivityReportPage key={savedReport.id} organisationId={organisationId} savedReport={savedReport} />
  );
}
