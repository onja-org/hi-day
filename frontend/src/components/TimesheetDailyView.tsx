"use client";

import { isSameDay } from "date-fns";
import type { DateRange, DateRangePreset } from "@/types/dateRange";
import type { TimeEntryListItem } from "@/types/timeEntry";
import type { ReactNode } from "react";
import { DateRangePicker } from "@/components/DateRangePicker";
import { DATE_RANGE_PRESET_LABELS } from "@/components/DateRangePresetList";
import { ErrorMessage } from "@/components/ErrorMessage";
import { Spinner } from "@/components/Spinner";
import { TimesheetProjectBreakdown } from "@/components/TimesheetProjectBreakdown";
import { TimesheetSummaryTiles } from "@/components/TimesheetSummaryTiles";
import { TimesheetTable } from "@/components/TimesheetTable";

type TimesheetDailyViewProps = {
  organisationId: string;
  /** The timezone selector, rendered beside the date range — the two
   * together decide which days the page is showing. */
  timezoneSelect: ReactNode;
  /** Which zone the entries are read in; decides their day and clock time. */
  zone: string;
  isOwnTimesheet: boolean;
  datePreset: DateRangePreset | null;
  defaultDatePreset: DateRangePreset;
  range: DateRange;
  onDateRangeChange: (range: DateRange, preset: DateRangePreset | null) => void;
  entries?: TimeEntryListItem[];
  isLoading: boolean;
  isError: boolean;
  errorMessage?: string;
};

export function TimesheetDailyView({
  organisationId,
  timezoneSelect,
  zone,
  isOwnTimesheet,
  datePreset,
  defaultDatePreset,
  range,
  onDateRangeChange,
  entries,
  isLoading,
  isError,
  errorMessage,
}: TimesheetDailyViewProps) {
  const emptyPeriodLabel = datePreset
    ? DATE_RANGE_PRESET_LABELS[datePreset].toLowerCase()
    : "this period";

  return (
    <>
      <div className="flex flex-wrap items-end gap-3">
        <DateRangePicker
          id="timesheet-date-range"
          label="Date range"
          value={range}
          preset={datePreset}
          defaultPreset={defaultDatePreset}
          onChange={onDateRangeChange}
        />
        {timezoneSelect}
      </div>

      {isLoading && (
        <p className="flex items-center gap-2 text-slate-900">
          <Spinner className="text-primary-dark" />
          Loading timesheet…
        </p>
      )}

      {isError && (
        <ErrorMessage
          message={errorMessage ?? "Could not load this timesheet."}
        />
      )}

      {entries && (
        <>
          <TimesheetSummaryTiles
            entries={entries}
            zone={zone}
            isSingleDay={isSameDay(range.from, range.to)}
          />

          <TimesheetProjectBreakdown entries={entries} />

          <div className="flex flex-col gap-2">
            <h2 className="flex items-baseline gap-2 text-lg font-semibold text-primary-dark">
              Entries
              <span className="text-sm font-normal text-slate-900/60">
                {entries.length} session{entries.length === 1 ? "" : "s"}
              </span>
            </h2>
            <TimesheetTable
              organisationId={organisationId}
              entries={entries}
              zone={zone}
              isOwnTimesheet={isOwnTimesheet}
              emptyPeriodLabel={emptyPeriodLabel}
            />
          </div>
        </>
      )}
    </>
  );
}
