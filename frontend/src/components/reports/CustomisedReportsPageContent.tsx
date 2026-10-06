"use client";

import { useState } from "react";
import Link from "next/link";
import { ActionsMenu } from "@/components/ActionsMenu";
import { ErrorMessage } from "@/components/ErrorMessage";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { Table } from "@/components/ui/table/Table";
import { TableBody } from "@/components/ui/table/TableBody";
import { TableCell } from "@/components/ui/table/TableCell";
import { TableHead } from "@/components/ui/table/TableHead";
import { TableHeader } from "@/components/ui/table/TableHeader";
import { TableRow } from "@/components/ui/table/TableRow";
import { describeSchedule } from "@/lib/describeSchedule";
import { useSavedReports } from "@/hooks/useSavedReports";
import type { SavedReport } from "@/types/savedReport";
import { ReportPageHeader } from "./ReportPageHeader";
import { ReportStatus } from "./ReportStatus";

type CustomisedReportsPageContentProps = {
  organisationId: string;
};

function scheduleStatus(report: SavedReport): string {
  if (!report.schedule) return "-";
  if (report.lastError) return `Failed: ${report.lastError}`;
  if (report.lastSentAt) return `Last sent ${new Date(report.lastSentAt).toLocaleString()}`;
  return "Scheduled";
}

export function CustomisedReportsPageContent({ organisationId }: CustomisedReportsPageContentProps) {
  const { reports, isReady, error, deleteReport } = useSavedReports(organisationId);
  const [deleting, setDeleting] = useState<SavedReport | null>(null);
  const [deleteError, setDeleteError] = useState<string | undefined>();
  const reportsBase = `/organisations/${organisationId}/reports`;

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
        <Table className="min-w-2xl">
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
              <TableRow key={report.id}>
                <TableCell>
                  <Link href={`${reportsBase}/saved/${report.id}`} className="font-medium text-primary hover:underline">
                    {report.name}
                  </Link>
                </TableCell>
                <TableCell>Time &amp; activity</TableCell>
                <TableCell>{new Date(report.modifiedAt).toLocaleString()}</TableCell>
                <TableCell>{report.schedule ? describeSchedule(report.schedule) : "-"}</TableCell>
                <TableCell>{scheduleStatus(report)}</TableCell>
                <TableCell align="right">
                  <ActionsMenu
                    items={[
                      { label: "Open", href: `${reportsBase}/saved/${report.id}` },
                      { label: "Delete", tone: "danger", onSelect: () => setDeleting(report) },
                    ]}
                  />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
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
