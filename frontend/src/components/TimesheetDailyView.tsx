"use client";

import { isSameDay } from "date-fns";
import type { DateRange, DateRangePreset } from "@/types/dateRange";
import type { TimeEntryListItem } from "@/types/timeEntry";
import { DateRangePicker } from "./DateRangePicker";
import { DATE_RANGE_PRESET_LABELS } from "./DateRangePresetList";
import { ErrorMessage } from "./ErrorMessage";
import { Spinner } from "./Spinner";
import { TimesheetProjectBreakdown } from "./TimesheetProjectBreakdown";
import { TimesheetSummaryTiles } from "./TimesheetSummaryTiles";
import { TimesheetTable } from "./TimesheetTable";

type TimesheetDailyViewProps = {
  organisationId: string;
  isOwnTimesheet: boolean;
  /** null while a custom calendar range is applied. */
  datePreset: DateRangePreset | null;
  defaultDatePreset: DateRangePreset;
  range: DateRange;
  onDateRangeChange: (range: DateRange, preset: DateRangePreset | null) => void;
  entries?: TimeEntryListItem[];
  isLoading: boolean;
  isError: boolean;
  errorMessage?: string;
};

/** The Timesheets page's Daily tab body: date-range picker, then the
 * summary tiles / project breakdown / entries table — split out of `TimeEntriesPageContent` to keep that file under the
 * components size guideline. */
export function TimesheetDailyView({
  organisationId,
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
      <DateRangePicker
        value={range}
        preset={datePreset}
        defaultPreset={defaultDatePreset}
        onChange={onDateRangeChange}
      />

      {isLoading && (
        <p className="flex items-center gap-2 text-slate-900">
          <Spinner className="text-primary-dark" />
          Loading timesheet…
        </p>
      )}

      {isError && <ErrorMessage message={errorMessage ?? "Could not load this timesheet."} />}

      {entries && (
        <>
          <TimesheetSummaryTiles entries={entries} isSingleDay={isSameDay(range.from, range.to)} />

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
              isOwnTimesheet={isOwnTimesheet}
              emptyPeriodLabel={emptyPeriodLabel}
            />
          </div>
        </>
      )}
    </>
  );
}
