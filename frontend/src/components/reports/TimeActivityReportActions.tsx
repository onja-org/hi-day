"use client";

import { useState } from "react";
import { format } from "date-fns";
import { ExportButtons } from "@/components/ExportButtons";
import { useModalSubmit } from "@/hooks/useModalSubmit";
import { buildTimeActivityAttachment } from "@/lib/buildTimeActivityAttachment";
import { entriesToCsv } from "@/lib/entriesToCsv";
import { sendReport } from "@/lib/sendReport";
import { countReportFilters } from "@/lib/reportFilters";
import type { ReportFilters } from "@/lib/reportFilters";
import type { DateRange } from "@/types/dateRange";
import type { ReportSchedule } from "@/types/reportSchedule";
import type { SavedReport } from "@/types/savedReport";
import type { SendReportInput } from "@/types/sendReport";
import type { MembershipTeamNames, TimeActivityGrouping } from "@/types/timeActivityGrouping";
import type { TimeEntryListItem } from "@/types/timeEntry";
import { SaveReportButton } from "./SaveReportButton";
import { ScheduleReportButton } from "./ScheduleReportButton";
import { ScheduleReportModal } from "./ScheduleReportModal";
import { SendReportButton } from "./SendReportButton";
import { TimeActivityFilter } from "./TimeActivityFilter";
import { TimeActivityReportSettings } from "./TimeActivityReportSettings";

type Option = { id: string; name: string };

type TimeActivityReportActionsProps = {
  organisationId: string;
  entries: TimeEntryListItem[] | undefined;
  range: DateRange;
  /** The zone the report is read in, so exported files match the screen. */
  zone: string;
  grouping: TimeActivityGrouping;
  teamNames: MembershipTeamNames;
  idleMembers: { id: string; label: string }[];
  showsEveryone: boolean;
  filters: ReportFilters;
  onFiltersChange: (filters: ReportFilters) => void;
  projectOptions: Option[];
  memberOptions: Option[] | undefined;
  teamOptions: Option[] | undefined;
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
  // Set while the schedule modal is open, carrying the name already typed in the save modal.
  const [scheduleFor, setScheduleFor] = useState<{ name: string } | null>(null);
  const scheduling = useModalSubmit();
  function closeSchedule() {
    setScheduleFor(null);
    scheduling.reset();
  }

  const filenameBase = `time-and-activity-${format(range.from, "yyyy-MM-dd")}-to-${format(range.to, "yyyy-MM-dd")}`;

  // Builds the file the way the report currently looks, then has the
  // backend email it. Resolves with a message on failure, nothing on success.
  async function handleSend(input: SendReportInput): Promise<string | void> {
    if (!entries || entries.length === 0) return "There's nothing to send for this date range.";
    try {
      const contentBase64 = await buildTimeActivityAttachment(input.fileType, {
        entries,
        grouping,
        teamNames,
        idleMembers,
        zone,
        title: input.subject,
      });
      const result = await sendReport(organisationId, {
        ...input,
        filename: `${filenameBase}.${input.fileType}`,
        contentBase64,
      });
      if (!result.ok) return result.message;
    } catch {
      return "The report file could not be built. Please try again.";
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <ExportButtons
        csv={entriesToCsv(entries ?? [], zone)}
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
        <ScheduleReportModal
          initialName={scheduleFor.name}
          initialSchedule={savedReport?.schedule ?? undefined}
          isPending={scheduling.isPending}
          errorMessage={scheduling.errorMessage}
          onClose={closeSchedule}
          onSchedule={async ({ name, ...schedule }) => {
            if (await scheduling.submit(() => onPersist({ name, schedule }))) closeSchedule();
          }}
        />
      )}
    </div>
  );
}
