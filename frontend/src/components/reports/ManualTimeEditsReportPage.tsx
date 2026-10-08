"use client";

import { useState } from "react";
import { ClockClockwiseIcon, ClockCountdownIcon } from "@phosphor-icons/react";
import { ExportButtons } from "@/components/ExportButtons";
import { SelectField } from "@/components/ui/form/SelectField";
import { useActiveMembers } from "@/hooks/useActiveMembers";
import { useCanViewOthers } from "@/hooks/useCanViewOthers";
import { useCurrentOrganisation } from "@/hooks/useCurrentOrganisation";
import { useManualTimeEdits } from "@/hooks/useManualTimeEdits";
import { useMyProjects } from "@/hooks/useMyProjects";
import { useSavedReportPersist } from "@/hooks/useSavedReportPersist";
import { useTimeActivityReportControls } from "@/hooks/useTimeActivityReportControls";
import { buildReportTableAttachment } from "@/lib/buildReportTableAttachment";
import { buildManualTimeEditRows } from "@/lib/buildManualTimeEditRows";
import { formatElapsed } from "@/lib/formatElapsed";
import { filterManualTimeEdits } from "@/lib/filterManualTimeEdits";
import { manualTimeEditProjectOptions } from "@/lib/manualTimeEditProjectOptions";
import {
  MANUAL_TIME_EDIT_ACTION_LABELS,
  MANUAL_TIME_EDITS_COLUMNS,
} from "@/lib/manualTimeEditsReportConfig";
import { reportFilenameBase } from "@/lib/reportFilenameBase";
import { reportTableToCsv } from "@/lib/reportTableToCsv";
import { sendReportFile } from "@/lib/sendReportFile";
import { sumManualTimeEdits } from "@/lib/sumManualTimeEdits";
import type { ManualTimeEditAction } from "@/types/manualTimeEdit";
import type { SavedReport } from "@/types/savedReport";
import type { SendReportInput } from "@/types/sendReport";
import { ReportDateRangePicker } from "./ReportDateRangePicker";
import { ReportPageHeader } from "./ReportPageHeader";
import { ReportScopeTabs } from "./ReportScopeTabs";
import { ReportStatus } from "./ReportStatus";
import { ReportTableHeading } from "./ReportTableHeading";
import { ReportsStatCard } from "./ReportsStatCard";
import { ReportsTable } from "./ReportsTable";
import { ScheduleReportButton } from "./ScheduleReportButton";
import { ScheduleReportDialog } from "./ScheduleReportDialog";
import { SendReportButton } from "./SendReportButton";
import { TimeActivityFilter } from "./TimeActivityFilter";

type ManualTimeEditsReportPageProps = {
  organisationId: string;
  /** Set when a saved report is opened: restores its settings and updates it on Schedule. */
  savedReport?: SavedReport;
};

/** Who added, edited or deleted time entries by hand, read back from the audit log. */
export function ManualTimeEditsReportPage({ organisationId, savedReport }: ManualTimeEditsReportPageProps) {
  const organisationQuery = useCurrentOrganisation();
  const canViewOthers = useCanViewOthers();
  const [scheduling, setScheduling] = useState(false);
  const [action, setAction] = useState<ManualTimeEditAction | "all">("all");
  const { scope, setScope, preset, setPreset, filters, setFilters, setCustomDays, zone, range } =
    useTimeActivityReportControls(savedReport?.settings);
  const showsEveryone = canViewOthers && scope === "all";
  const editsQuery = useManualTimeEdits(organisationId, showsEveryone ? "all" : "me", range);
  const membersQuery = useActiveMembers(organisationId, { enabled: showsEveryone });
  const myProjectsQuery = useMyProjects(organisationId);

  // A member choice left over from the "All" tab must not silently narrow "Me".
  const activeFilters = showsEveryone ? filters : { ...filters, memberIds: [] };
  const edits = editsQuery.data ? filterManualTimeEdits(editsQuery.data, activeFilters, action) : undefined;
  const rows = edits ? buildManualTimeEditRows(edits, zone) : undefined;
  const totals = edits ? sumManualTimeEdits(edits) : undefined;
  const filenameBase = reportFilenameBase("manual-time-edits", range);

  const title = `Manual time edits report${savedReport ? ` - ${savedReport.name}` : ""}`;

  function handleSend(input: SendReportInput): Promise<string | void> {
    return sendReportFile({
      organisationId,
      input,
      filenameBase,
      isEmpty: !rows || rows.length === 0,
      buildContent: (fileType, fileTitle) =>
        buildReportTableAttachment(fileType, MANUAL_TIME_EDITS_COLUMNS, rows ?? [], fileTitle),
    });
  }

  // The Action choice isn't part of a saved report; a scheduled email lists every action.
  const persist = useSavedReportPersist(
    organisationId,
    savedReport,
    { preset, range, zone, scope: showsEveryone ? "all" : "me", grouping: "day", filters: activeFilters },
    "manual-time-edits",
  );

  return (
    <div className="flex flex-col gap-6">
      <ReportPageHeader organisationId={organisationId} title={title} />

      <ReportTableHeading organisationName={organisationQuery.data?.name} zone={zone} />

      {canViewOthers && <ReportScopeTabs value={scope} onChange={setScope} />}

      <div className="flex flex-wrap items-end justify-between gap-4">
        <ReportDateRangePicker
          id="manual-time-edits-date-range"
          range={range}
          preset={preset}
          zone={zone}
          setCustomDays={setCustomDays}
          setPreset={setPreset}
        />
        <div className="flex flex-wrap items-end gap-3">
          <SelectField
            label="Action"
            value={action}
            onChange={(event) => setAction(event.target.value as ManualTimeEditAction | "all")}
            className="w-fit"
          >
            <option value="all">All actions</option>
            {(Object.keys(MANUAL_TIME_EDIT_ACTION_LABELS) as ManualTimeEditAction[]).map((value) => (
              <option key={value} value={value}>
                {MANUAL_TIME_EDIT_ACTION_LABELS[value]}
              </option>
            ))}
          </SelectField>
          <TimeActivityFilter
            filters={activeFilters}
            onChange={setFilters}
            projectOptions={manualTimeEditProjectOptions(myProjectsQuery.data ?? [], editsQuery.data ?? [])}
            memberOptions={
              showsEveryone
                ? (membersQuery.data ?? []).map((member) => ({ id: member.id, name: member.name ?? member.email }))
                : undefined
            }
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <ReportsStatCard
          label="Hours added"
          value={totals && edits!.length > 0 ? formatElapsed(totals.addedSeconds * 1000) : "--"}
          icon={ClockClockwiseIcon}
        />
        <ReportsStatCard
          label="Hours deleted"
          value={totals && edits!.length > 0 ? formatElapsed(totals.deletedSeconds * 1000) : "--"}
          icon={ClockCountdownIcon}
        />
      </div>

      {scheduling && (
        <ScheduleReportDialog
          initialName={savedReport?.name ?? ""}
          initialSchedule={savedReport?.schedule ?? undefined}
          onPersist={persist}
          onClose={() => setScheduling(false)}
        />
      )}

      <ReportStatus isLoading={editsQuery.isLoading} error={editsQuery.error} />
      {rows && (
        <>
          <div className="flex flex-wrap items-center justify-end gap-3">
            <ExportButtons
              csv={reportTableToCsv(MANUAL_TIME_EDITS_COLUMNS, rows)}
              filenameBase={filenameBase}
              disabled={rows.length === 0}
            />
            <SendReportButton defaultSubject={title} onSend={handleSend} />
            <ScheduleReportButton onClick={() => setScheduling(true)} />
          </div>
          {rows.length === 0 ? (
            <p className="text-sm text-slate-900">No manual time edits in this period.</p>
          ) : (
            <ReportsTable columns={MANUAL_TIME_EDITS_COLUMNS} rows={rows} />
          )}
        </>
      )}
    </div>
  );
}
