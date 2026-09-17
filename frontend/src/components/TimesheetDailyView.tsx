"use client";

import { CalendarBlankIcon } from "@phosphor-icons/react";
import clsx from "clsx";
import type { TimesheetDatePreset } from "@/lib/getTimesheetDateRange";
import type { TimeEntryListItem } from "@/types/timeEntry";
import { ErrorMessage } from "./ErrorMessage";
import { Spinner } from "./Spinner";
import { TimesheetProjectBreakdown } from "./TimesheetProjectBreakdown";
import { TimesheetSummaryTiles } from "./TimesheetSummaryTiles";
import { TimesheetTable } from "./TimesheetTable";

const DATE_PRESET_LABELS: Record<TimesheetDatePreset, string> = {
  today: "Today",
  yesterday: "Yesterday",
  this_week: "This week",
  this_month: "This month",
  all: "All time",
};

function formatDateRangeLabel(range: { from: Date; to: Date } | null): string {
  if (!range) {
    return "All time";
  }
  const options: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" };
  const from = range.from.toLocaleDateString([], options);
  const to = range.to.toLocaleDateString([], { ...options, year: "numeric" });
  return `${from} – ${to}`;
}

type TimesheetDailyViewProps = {
  organisationId: string;
  isOwnTimesheet: boolean;
  datePreset: TimesheetDatePreset;
  onDatePresetChange: (preset: TimesheetDatePreset) => void;
  range: { from: Date; to: Date } | null;
  entries?: TimeEntryListItem[];
  isLoading: boolean;
  isError: boolean;
  errorMessage?: string;
};

/** The Timesheets page's Daily tab body: date-preset picker + resolved
 * date-range readout, then the summary tiles / project breakdown / entries
 * table — split out of `TimeEntriesPageContent` to keep that file under the
 * components size guideline. */
export function TimesheetDailyView({
  organisationId,
  isOwnTimesheet,
  datePreset,
  onDatePresetChange,
  range,
  entries,
  isLoading,
  isError,
  errorMessage,
}: TimesheetDailyViewProps) {
  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div
          role="group"
          aria-label="Date range"
          className="inline-flex rounded-lg border border-input-border p-1"
        >
          {Object.entries(DATE_PRESET_LABELS).map(([value, label]) => (
            <button
              key={value}
              type="button"
              aria-pressed={datePreset === value}
              onClick={() => onDatePresetChange(value as TimesheetDatePreset)}
              className={clsx(
                "cursor-pointer rounded-md px-3 py-1 text-sm font-medium transition-colors duration-150",
                datePreset === value
                  ? "bg-primary text-white"
                  : "text-slate-900 hover:bg-cream",
              )}
            >
              {label}
            </button>
          ))}
        </div>
        <span className="flex items-center gap-1.5 text-sm text-slate-900/70">
          <CalendarBlankIcon size={14} aria-hidden="true" />
          {formatDateRangeLabel(range)}
        </span>
      </div>

      {isLoading && (
        <p className="flex items-center gap-2 text-slate-900">
          <Spinner className="text-primary-dark" />
          Loading timesheet…
        </p>
      )}

      {isError && <ErrorMessage message={errorMessage ?? "Could not load this timesheet."} />}

      {entries && (
        <>
          <TimesheetSummaryTiles entries={entries} datePreset={datePreset} />

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
              datePreset={datePreset}
            />
          </div>
        </>
      )}
    </>
  );
}
