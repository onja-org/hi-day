"use client";

import { useState } from "react";
import { ExportButtons } from "@/components/ExportButtons";
import { useOrganisationWeekStart } from "@/hooks/useOrganisationWeekStart";
import { useProjectsEnabled } from "@/hooks/useProjectsEnabled";
import { buildTimeActivityAttachment } from "@/lib/buildTimeActivityAttachment";
import { entriesToCsv } from "@/lib/entriesToCsv";
import { reportFilenameBase } from "@/lib/reportFilenameBase";
import { sendReportFile } from "@/lib/sendReportFile";
import { countReportFilters } from "@/lib/reportFilters";
import type { ReportFilters } from "@/lib/reportFilters";
import type { IdleMember } from "@/types/idleMember";
import type { DateRange } from "@/types/dateRange";
import type { ReportSchedule } from "@/types/reportSchedule";
import type { SavedReport } from "@/types/savedReport";
import type { SendReportInput } from "@/types/sendReport";
import type { MembershipTeamNames, TimeActivityGrouping } from "@/types/timeActivityGrouping";
import type { TimeEntryListItem } from "@/types/timeEntry";
import type { ReportFilterOption } from "@/types/reportFilterOption";
import { SaveReportButton } from "./SaveReportButton";
import { ScheduleReportButton } from "./ScheduleReportButton";
import { ScheduleReportDialog } from "./ScheduleReportDialog";
import { SendReportButton } from "./SendReportButton";
import { TimeActivityFilter } from "./TimeActivityFilter";
import { TimeActivityReportSettings } from "./TimeActivityReportSettings";

type TimeActivityReportActionsProps = {
  organisationId: string;
  entries: TimeEntryListItem[] | undefined;
  range: DateRange;
  /** The zone the report is read in, so exported files match the screen. */
  zone: string;
  grouping: TimeActivityGrouping;
  teamNames: MembershipTeamNames;
  idleMembers: IdleMember[];
  showsEveryone: boolean;
  filters: ReportFilters;
  onFiltersChange: (filters: ReportFilters) => void;
  projectOptions: ReportFilterOption[];
  memberOptions: ReportFilterOption[] | undefined;
  teamOptions: ReportFilterOption[] | undefined;
  /** Set when a saved report is open: its name and schedule prefill the modals. */
  savedReport: SavedReport | undefined;
  /** Saves the report; resolves with a message on failure, nothing on success. */
  onPersist: (input: { name: string; schedule: ReportSchedule | null }) => Promise<string | void>;
};

/** The report's toolbar: export, send, schedule, filter and save. */
export function TimeActivityReportActions({
  organisationId,
  entries,
  range,
  zone,
  grouping,
  teamNames,
  idleMembers,
  showsEveryone,
  filters,
  onFiltersChange,
  projectOptions,
  memberOptions,
  teamOptions,
  savedReport,
  onPersist,
}: TimeActivityReportActionsProps) {
  const projectsEnabled = useProjectsEnabled();
  // Set while the schedule modal is open, carrying the name already typed in the save modal.
  const [scheduleFor, setScheduleFor] = useState<{ name: string } | null>(null);
  const weekStart = useOrganisationWeekStart();

  const filenameBase = reportFilenameBase("time-and-activity", range);

  function handleSend(input: SendReportInput): Promise<string | void> {
    return sendReportFile({
      organisationId,
      input,
      filenameBase,
      isEmpty: !entries || entries.length === 0,
      buildContent: (fileType, title) =>
        buildTimeActivityAttachment(fileType, { entries: entries ?? [], grouping, teamNames, idleMembers, zone, title, weekStart, projectsEnabled }),
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <ExportButtons
        csv={entriesToCsv(entries ?? [], zone, projectsEnabled)}
        filenameBase={filenameBase}
        disabled={(entries ?? []).length === 0}
      />
      <SendReportButton
        defaultSubject={`Time and activity report${savedReport ? ` - ${savedReport.name}` : ""}`}
        onSend={handleSend}
      />
      <ScheduleReportButton onClick={() => setScheduleFor({ name: savedReport?.name ?? "" })} />
      <TimeActivityFilter
        filters={filters}
        onChange={onFiltersChange}
        projectOptions={projectOptions}
        memberOptions={memberOptions}
        teamOptions={teamOptions}
      />
      <SaveReportButton
        settings={
          <TimeActivityReportSettings
            range={range}
            showsEveryone={showsEveryone}
            grouping={grouping}
            filterCount={countReportFilters(filters)}
          />
        }
        initialName={savedReport?.name}
        initialScheduled={savedReport !== undefined && savedReport.schedule !== null}
        // Turning the schedule switch on continues to the schedule form
        // rather than saving, so the report is only stored once it has one;
        // leaving it off saves the report and removes any schedule it had.
        onSave={async ({ name, scheduled }) => {
          if (scheduled) setScheduleFor({ name });
          else return onPersist({ name, schedule: null });
        }}
      />
      {scheduleFor && (
        <ScheduleReportDialog
          initialName={scheduleFor.name}
          initialSchedule={savedReport?.schedule ?? undefined}
          onPersist={onPersist}
          onClose={() => setScheduleFor(null)}
        />
      )}
    </div>
  );
}
