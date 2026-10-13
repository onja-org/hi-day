"use client";

import { useState } from "react";
import { ExportButtons } from "@/components/ExportButtons";
import { useCurrentOrganisation } from "@/hooks/useCurrentOrganisation";
import { useSavedReportPersist } from "@/hooks/useSavedReportPersist";
import { useTimeActivityReportControls } from "@/hooks/useTimeActivityReportControls";
import { useTimeActivityReportData } from "@/hooks/useTimeActivityReportData";
import { buildDailyTotalsReport } from "@/lib/buildDailyTotalsReport";
import { buildReportTableAttachment } from "@/lib/buildReportTableAttachment";
import { dailyTotalsTable } from "@/lib/dailyTotalsTable";
import { reportFilenameBase } from "@/lib/reportFilenameBase";
import { reportTableToCsv } from "@/lib/reportTableToCsv";
import { sendReportFile } from "@/lib/sendReportFile";
import type { SavedReport } from "@/types/savedReport";
import type { SendReportInput } from "@/types/sendReport";
import { DailyTotalsReportBody } from "./DailyTotalsReportBody";
import { ReportDateRangePicker } from "./ReportDateRangePicker";
import { ReportPageHeader } from "./ReportPageHeader";
import { ReportScopeTabs } from "./ReportScopeTabs";
import { ReportStatus } from "./ReportStatus";
import { ReportTableHeading } from "./ReportTableHeading";
import { ScheduleReportButton } from "./ScheduleReportButton";
import { ScheduleReportDialog } from "./ScheduleReportDialog";
import { SendReportButton } from "./SendReportButton";
import { TimeActivityFilter } from "./TimeActivityFilter";

type DailyTotalsReportPageProps = {
  organisationId: string;
  /** Set when a saved report is opened: restores its settings and updates it on Schedule. */
  savedReport?: SavedReport;
};

/** Reuses the Time and activity report's controls and data, shown as a project-by-day grid. */
export function DailyTotalsReportPage({ organisationId, savedReport }: DailyTotalsReportPageProps) {
  const organisationQuery = useCurrentOrganisation();
  const [scheduling, setScheduling] = useState(false);
  const { scope, setScope, preset, setPreset, filters, setFilters, setCustomDays, zone, range } =
    useTimeActivityReportControls(savedReport?.settings, organisationQuery.data?.timezone);
  const { canViewOthers, activeFilters, projectOptions, entries, isLoading, error } = useTimeActivityReportData(
    organisationId,
    scope,
    range,
    filters,
    !organisationQuery.isLoading,
  );
  const report = entries ? buildDailyTotalsReport(entries, range) : undefined;
  const table = report ? dailyTotalsTable(report) : undefined;
  const filenameBase = reportFilenameBase("daily-totals", range);

  function handleSend(input: SendReportInput): Promise<string | void> {
    return sendReportFile({
      organisationId,
      input,
      filenameBase,
      isEmpty: !report || report.rows.length === 0,
      buildContent: (fileType, title) =>
        buildReportTableAttachment(fileType, table?.columns ?? [], table?.rows ?? [], title),
    });
  }

  const persist = useSavedReportPersist(
    organisationId,
    savedReport,
    {
      preset,
      range,
      zone,
      scope: scope === "all" && canViewOthers ? "all" : "me",
      grouping: "day",
      filters: activeFilters,
    },
    "daily-totals",
  );

  return (
    <div className="flex flex-col gap-6">
      <ReportPageHeader
        organisationId={organisationId}
        title={`Daily totals report (Weekly)${savedReport ? ` - ${savedReport.name}` : ""}`}
      />

      <ReportTableHeading organisationName={organisationQuery.data?.name} zone={zone} />

      {canViewOthers && <ReportScopeTabs value={scope} onChange={setScope} />}

      <div className="flex flex-wrap items-end justify-between gap-4">
        <ReportDateRangePicker
          id="daily-totals-date-range"
          range={range}
          preset={preset}
          zone={zone}
          setCustomDays={setCustomDays}
          setPreset={setPreset}
        />
        <TimeActivityFilter filters={activeFilters} onChange={setFilters} projectOptions={projectOptions} />
      </div>

      {scheduling && (
        <ScheduleReportDialog
          initialName={savedReport?.name ?? ""}
          initialSchedule={savedReport?.schedule ?? undefined}
          onPersist={persist}
          onClose={() => setScheduling(false)}
        />
      )}

      <ReportStatus isLoading={isLoading || organisationQuery.isLoading} error={error} />
      {entries && report && table && (
        <DailyTotalsReportBody
          report={report}
          actions={
            <>
              <ExportButtons
                csv={table ? reportTableToCsv(table.columns, table.rows) : ""}
                filenameBase={filenameBase}
                disabled={!report || report.rows.length === 0}
              />
              <SendReportButton
                defaultSubject={`Daily totals report${savedReport ? ` - ${savedReport.name}` : ""}`}
                onSend={handleSend}
              />
              <ScheduleReportButton onClick={() => setScheduling(true)} />
            </>
          }
        />
      )}
    </div>
  );
}
