"use client";

import { useState } from "react";
import { ErrorMessage } from "@/components/ErrorMessage";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { Table } from "@/components/ui/table/Table";
import { TableBody } from "@/components/ui/table/TableBody";
import { TableHead } from "@/components/ui/table/TableHead";
import { TableHeader } from "@/components/ui/table/TableHeader";
import { TableRow } from "@/components/ui/table/TableRow";
import { useCurrentOrganisation } from "@/hooks/useCurrentOrganisation";
import { useFavouriteReports } from "@/hooks/useFavouriteReports";
import { useSavedReports } from "@/hooks/useSavedReports";
import type { ReportSchedule } from "@/types/reportSchedule";
import type { SavedReport } from "@/types/savedReport";
import { ReportPageHeader } from "./ReportPageHeader";
import { ReportStatus } from "./ReportStatus";
import { SavedReportRow } from "./SavedReportRow";

type CustomisedReportsPageContentProps = {
  organisationId: string;
};

export function CustomisedReportsPageContent({ organisationId }: CustomisedReportsPageContentProps) {
  const { reports, isReady, error, saveReport, setSchedulePaused, deleteReport } = useSavedReports(organisationId);
  const organisationQuery = useCurrentOrganisation();
  const zone = organisationQuery.data?.timezone ?? "UTC";
  const { favouriteIds, toggleFavourite } = useFavouriteReports(Number(organisationId));
  const [deleting, setDeleting] = useState<SavedReport | null>(null);
  const [deleteError, setDeleteError] = useState<string | undefined>();
  const reportsBase = `/organisations/${organisationId}/reports`;

  async function saveSchedule(
    report: SavedReport,
    input: { name: string; schedule: ReportSchedule },
  ): Promise<string | void> {
    const result = await saveReport({ id: report.id, settings: report.settings, ...input });
    if (!result.ok) return result.message;
  }

  async function togglePaused(report: SavedReport) {
    setDeleteError(undefined);
    const result = await setSchedulePaused(report.id, !report.schedulePaused);
    if (!result.ok) setDeleteError(result.message);
  }

  return (
    <div className="flex flex-col gap-6">
      <ReportPageHeader organisationId={organisationId} title="Customised reports" />

      {!isReady || error ? (
        <ReportStatus isLoading={!isReady} error={error} loadingLabel="Loading reports…" />
      ) : reports.length === 0 ? (
        <p className="rounded-lg border border-input-border bg-white p-6 text-center text-sm text-slate-900/70">
          No customised reports yet. Save a report from its page to find it here.
        </p>
      ) : (
        <div className="rounded-lg border border-input-border">
          <Table bare className="min-w-2xl">
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Report type</TableHead>
                <TableHead>Date last modified</TableHead>
                <TableHead>Schedule details</TableHead>
                <TableHead>Schedule status</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {reports.map((report) => (
                <SavedReportRow
                  key={report.id}
                  report={report}
                  href={`${reportsBase}/saved/${report.id}`}
                  zone={zone}
                  isFavourite={favouriteIds.includes(report.id)}
                  onToggleFavourite={() => toggleFavourite(report.id)}
                  onSaveSchedule={saveSchedule}
                  onTogglePaused={() => togglePaused(report)}
                  onDelete={() => setDeleting(report)}
                />
              ))}
            </TableBody>
          </Table>
          <p className="border-t border-input-border p-3 text-sm text-slate-900/70">
            Showing {reports.length} {reports.length === 1 ? "report" : "reports"}
          </p>
        </div>
      )}

      {deleteError && <ErrorMessage message={deleteError} />}

      {deleting && (
        <ConfirmDialog
          title="Delete saved report"
          message={`Delete “${deleting.name}”? This can't be undone.`}
          confirmLabel="Delete"
          isDangerous
          onConfirm={async () => {
            const result = await deleteReport(deleting.id);
            if (result.ok) setDeleting(null);
            else setDeleteError(result.message);
          }}
          onClose={() => setDeleting(null)}
        />
      )}
    </div>
  );
}
