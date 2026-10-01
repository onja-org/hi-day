"use client";

import { format } from "date-fns";
import { ExportButtons } from "@/components/ExportButtons";
import { entriesToCsv } from "@/lib/entriesToCsv";
import { countReportFilters } from "@/lib/reportFilters";
import type { ReportFilters } from "@/lib/reportFilters";
import type { DateRange } from "@/types/dateRange";
import type { ReportSchedule } from "@/types/reportSchedule";
import type { SavedReport } from "@/types/savedReport";
import type { TimeActivityGrouping } from "@/types/timeActivityGrouping";
import type { TimeEntryListItem } from "@/types/timeEntry";
import { SaveReportButton } from "./SaveReportButton";
import { ScheduleReportButton } from "./ScheduleReportButton";
import { SendReportButton } from "./SendReportButton";
import { TimeActivityFilter } from "./TimeActivityFilter";
import { TimeActivityReportSettings } from "./TimeActivityReportSettings";

type Option = { id: string; name: string };

type TimeActivityReportActionsProps = {
  entries: TimeEntryListItem[] | undefined;
  range: DateRange;
  grouping: TimeActivityGrouping;
  showsEveryone: boolean;
  filters: ReportFilters;
  onFiltersChange: (filters: ReportFilters) => void;
  projectOptions: Option[];
  memberOptions: Option[] | undefined;
  teamOptions: Option[] | undefined;
  /** Set when a saved report is open: its name and schedule prefill the modals. */
  savedReport: SavedReport | undefined;
  onPersist: (input: { name: string; scheduled: boolean; schedule?: ReportSchedule }) => void;
};

/** The report's toolbar: export, send, schedule, filter and save. */
export function TimeActivityReportActions({
  entries,
  range,
  grouping,
  showsEveryone,
  filters,
  onFiltersChange,
  projectOptions,
  memberOptions,
  teamOptions,
  savedReport,
  onPersist,
}: TimeActivityReportActionsProps) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <ExportButtons
        csv={entriesToCsv(entries ?? [])}
        filenameBase={`time-and-activity-${format(range.from, "yyyy-MM-dd")}-to-${format(range.to, "yyyy-MM-dd")}`}
        disabled={(entries ?? []).length === 0}
      />
      <SendReportButton
        defaultSubject={`Time and activity report${savedReport ? ` - ${savedReport.name}` : ""}`}
        // The app has no email delivery yet, so say so rather than pretend it was sent.
        onSend={() => "Emailing reports isn't set up yet, so nothing was sent."}
      />
      <ScheduleReportButton
        initialName={savedReport?.name}
        initialSchedule={savedReport?.schedule}
        onSchedule={({ name, ...schedule }) => onPersist({ name, scheduled: true, schedule })}
      />
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
        initialScheduled={savedReport?.scheduled}
        onSave={({ name, scheduled }) => onPersist({ name, scheduled, schedule: savedReport?.schedule })}
      />
    </div>
  );
}
