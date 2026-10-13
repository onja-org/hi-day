"use client";

import { useState } from "react";
import { ExportButtons } from "@/components/ExportButtons";
import { useCurrentOrganisation } from "@/hooks/useCurrentOrganisation";
import { useSavedReportPersist } from "@/hooks/useSavedReportPersist";
import { useTimeActivityReportControls } from "@/hooks/useTimeActivityReportControls";
import { useTimeActivityReportData } from "@/hooks/useTimeActivityReportData";
import { buildReportTableAttachment } from "@/lib/buildReportTableAttachment";
import { useOrganisationWeekStart } from "@/hooks/useOrganisationWeekStart";
import { buildWorkSessionsRows } from "@/lib/buildWorkSessionsRows";
import { reportFilenameBase } from "@/lib/reportFilenameBase";
import { reportTableToCsv } from "@/lib/reportTableToCsv";
import { sendReportFile } from "@/lib/sendReportFile";
import { isWorkSessionsGrouping, workSessionsColumns } from "@/lib/workSessionsReportConfig";
import type { SavedReport } from "@/types/savedReport";
import type { SendReportInput } from "@/types/sendReport";
import { ReportDateRangePicker } from "./ReportDateRangePicker";
import { ReportPageHeader } from "./ReportPageHeader";
import { ReportScopeTabs } from "./ReportScopeTabs";
import { ReportStatus } from "./ReportStatus";
import { ReportTableHeading } from "./ReportTableHeading";
import { ScheduleReportButton } from "./ScheduleReportButton";
import { ScheduleReportDialog } from "./ScheduleReportDialog";
import { SendReportButton } from "./SendReportButton";
import { TimeActivityFilter } from "./TimeActivityFilter";
import { WorkSessionsReportBody } from "./WorkSessionsReportBody";

type WorkSessionsReportPageProps = {
  organisationId: string;
  /** Set when a saved report is opened: restores its settings and updates it on Schedule. */
  savedReport?: SavedReport;
};

/** Reuses the Time and activity report's controls and data, listing each timer run under its day. */
export function WorkSessionsReportPage({ organisationId, savedReport }: WorkSessionsReportPageProps) {
  const organisationQuery = useCurrentOrganisation();
  const [scheduling, setScheduling] = useState(false);
  const { scope, setScope, grouping: chosenGrouping, setGrouping, preset, setPreset, filters, setFilters, setCustomDays, zone, range } =
    useTimeActivityReportControls(savedReport?.settings);
  const { canViewOthers, showsEveryone, activeFilters, projectOptions, entries, isLoading, error } =
    useTimeActivityReportData(organisationId, scope, range, filters);
  const grouping = isWorkSessionsGrouping(chosenGrouping) ? chosenGrouping : "day";
  const columns = workSessionsColumns(grouping);
  const weekStart = useOrganisationWeekStart();
  const rows = entries
    ? buildWorkSessionsRows(entries, grouping, zone, weekStart)
    : undefined;
  const filenameBase = reportFilenameBase("work-sessions", range);

  function handleSend(input: SendReportInput): Promise<string | void> {
    return sendReportFile({
      organisationId,
      input,
      filenameBase,
      isEmpty: !rows || rows.length === 0,
      buildContent: (fileType, title) =>
        buildReportTableAttachment(fileType, columns, rows ?? [], title),
    });
  }

  const persist = useSavedReportPersist(
    organisationId,
    savedReport,
    {
      preset,
      range,
      zone,
      scope: showsEveryone ? "all" : "me",
      grouping,
      filters: activeFilters,
    },
    "work-sessions",
  );

  return (
    <div className="flex flex-col gap-6">
      <ReportPageHeader
        organisationId={organisationId}
        title={`Work sessions report${savedReport ? ` - ${savedReport.name}` : ""}`}
      />

      <ReportTableHeading organisationName={organisationQuery.data?.name} zone={zone} />

      {canViewOthers && <ReportScopeTabs value={scope} onChange={setScope} />}

      <div className="flex flex-wrap items-end justify-between gap-4">
        <ReportDateRangePicker
          id="work-sessions-date-range"
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

      <ReportStatus isLoading={isLoading} error={error} />
      {entries && rows && (
        <WorkSessionsReportBody
          entries={entries}
          rows={rows}
          grouping={grouping}
          onGroupingChange={setGrouping}
          range={range}
          actions={
            <>
              <ExportButtons
                csv={rows ? reportTableToCsv(columns, rows) : ""}
                filenameBase={filenameBase}
                disabled={!rows || rows.length === 0}
              />
              <SendReportButton
                defaultSubject={`Work sessions report${savedReport ? ` - ${savedReport.name}` : ""}`}
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
