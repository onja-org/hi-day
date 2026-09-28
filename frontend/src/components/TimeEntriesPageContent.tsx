"use client";

import { useState } from "react";
import { ClockIcon } from "@phosphor-icons/react";
import clsx from "clsx";
import { format } from "date-fns";
import { useActiveMembers } from "@/hooks/useActiveMembers";
import { useCurrentOrganisation } from "@/hooks/useCurrentOrganisation";
import { useTimeEntries } from "@/hooks/useTimeEntries";
import { entriesToCsv } from "@/lib/entriesToCsv";
import { getTimesheetDateRange } from "@/lib/getTimesheetDateRange";
import { getWeekRange } from "@/lib/getWeekRange";
import type { DateRange, DateRangePreset } from "@/types/dateRange";
import { ErrorMessage } from "./ErrorMessage";
import { ExportButtons } from "./ExportButtons";
import { Spinner } from "./Spinner";
import { TimeEntryFormModal } from "./TimeEntryFormModal";
import { TimesheetCalendarGrid } from "./TimesheetCalendarGrid";
import { TimesheetDailyView } from "./TimesheetDailyView";
import { TimesheetWeeklyMatrix } from "./TimesheetWeeklyMatrix";
import { WeekNavigator } from "./WeekNavigator";

type TimeEntriesPageContentProps = {
  organisationId: string;
};

type TimesheetViewMode = "daily" | "weekly" | "calendar";

const VIEW_MODE_LABELS: Record<TimesheetViewMode, string> = {
  daily: "Daily",
  weekly: "Weekly",
  calendar: "Calendar",
};

const DEFAULT_DATE_PRESET: DateRangePreset = "last_7_days";

export function TimeEntriesPageContent({ organisationId }: TimeEntriesPageContentProps) {
  const [addingTime, setAddingTime] = useState(false);
  // "" means "my own timesheet" — the default for everyone, including
  // admins/managers.
  const [viewingMembershipId, setViewingMembershipId] = useState("");
  const [viewMode, setViewMode] = useState<TimesheetViewMode>("daily");
  // null while a custom calendar range is applied. A preset's range is
  // re-resolved every render (below) rather than stored, so "Today" keeps
  // meaning today if the page stays open past midnight.
  const [datePreset, setDatePreset] = useState<DateRangePreset | null>(DEFAULT_DATE_PRESET);
  const [customRange, setCustomRange] = useState<DateRange>(() =>
    getTimesheetDateRange(DEFAULT_DATE_PRESET),
  );
  // Shared by the Weekly and Calendar tabs so switching between them keeps
  // the same week in view.
  const [weekOffset, setWeekOffset] = useState(0);

  const organisationQuery = useCurrentOrganisation();
  const canViewOthers =
    organisationQuery.data?.role === "admin" || organisationQuery.data?.role === "manager";
  const membersQuery = useActiveMembers(organisationId);

  const isOwnTimesheet = viewingMembershipId === "";
  const membershipId = isOwnTimesheet ? undefined : viewingMembershipId;

  const dailyRange = datePreset ? getTimesheetDateRange(datePreset) : customRange;
  const dailyEntriesQuery = useTimeEntries(
    organisationId,
    { membershipId, from: dailyRange.from, to: dailyRange.to },
    { enabled: viewMode === "daily" },
  );

  const now = new Date();
  const { start: weekStart, end: weekEnd } = getWeekRange(now, weekOffset);
  const weekEntriesQuery = useTimeEntries(
    organisationId,
    { membershipId, from: weekStart, to: weekEnd },
    { enabled: viewMode === "weekly" || viewMode === "calendar" },
  );

  const activeEntries = viewMode === "daily" ? dailyEntriesQuery.data : weekEntriesQuery.data;
  const activeFilenameBase =
    viewMode === "daily"
      ? `timesheet-${format(dailyRange.from, "yyyy-MM-dd")}-to-${format(dailyRange.to, "yyyy-MM-dd")}`
      : `timesheet-${viewMode}-${weekStart.toISOString().slice(0, 10)}`;

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-md bg-primary text-white">
            <ClockIcon size={18} aria-hidden="true" />
          </span>
          <h1 className="text-2xl font-semibold text-primary-dark">Timesheets</h1>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {canViewOthers && membersQuery.data && (
            <select
              value={viewingMembershipId}
              onChange={(event) => setViewingMembershipId(event.target.value)}
              className="rounded-md border border-input-border bg-white px-3 py-1.5 text-sm text-slate-900"
            >
              <option value="">My timesheet</option>
              {membersQuery.data.map((member) => (
                <option key={member.id} value={member.id}>
                  {member.name ?? member.email}
                </option>
              ))}
            </select>
          )}
          {isOwnTimesheet && (
            <button
              type="button"
              onClick={() => setAddingTime(true)}
              className="cursor-pointer rounded-md bg-primary px-4 py-2 text-white transition-colors duration-150 hover:bg-primary/90"
            >
              Add time
            </button>
          )}
          <ExportButtons
            csv={entriesToCsv(activeEntries ?? [])}
            filenameBase={activeFilenameBase}
            disabled={(activeEntries ?? []).length === 0}
          />
        </div>
      </div>

      <nav role="tablist" aria-label="View mode" className="flex gap-1 border-b border-input-border">
        {Object.entries(VIEW_MODE_LABELS).map(([value, label]) => (
          <button
            key={value}
            type="button"
            role="tab"
            aria-selected={viewMode === value}
            onClick={() => setViewMode(value as TimesheetViewMode)}
            className={clsx(
              "cursor-pointer border-b-2 px-3 py-2 text-sm font-medium transition-colors duration-150",
              viewMode === value
                ? "border-primary text-primary"
                : "border-transparent text-slate-900 hover:text-primary-dark",
            )}
          >
            {label}
          </button>
        ))}
      </nav>

      {viewMode === "daily" && (
        <TimesheetDailyView
          organisationId={organisationId}
          isOwnTimesheet={isOwnTimesheet}
          datePreset={datePreset}
          defaultDatePreset={DEFAULT_DATE_PRESET}
          range={dailyRange}
          onDateRangeChange={(range, preset) => {
            setCustomRange(range);
            setDatePreset(preset);
          }}
          entries={dailyEntriesQuery.data}
          isLoading={dailyEntriesQuery.isLoading}
          isError={dailyEntriesQuery.isError}
          errorMessage={
            dailyEntriesQuery.error instanceof Error ? dailyEntriesQuery.error.message : undefined
          }
        />
      )}

      {(viewMode === "weekly" || viewMode === "calendar") && (
        <div className="flex flex-col gap-3">
          <WeekNavigator weekOffset={weekOffset} onChange={setWeekOffset} />

          {weekEntriesQuery.isLoading && (
            <p className="flex items-center gap-2 text-slate-900">
              <Spinner className="text-primary-dark" />
              Loading timesheet…
            </p>
          )}

          {weekEntriesQuery.isError && <ErrorMessage message="Could not load this timesheet." />}

          {weekEntriesQuery.data && viewMode === "weekly" && (
            <TimesheetWeeklyMatrix entries={weekEntriesQuery.data} start={weekStart} />
          )}

          {weekEntriesQuery.data && viewMode === "calendar" && (
            <TimesheetCalendarGrid entries={weekEntriesQuery.data} start={weekStart} now={now} />
          )}
        </div>
      )}

      {addingTime && (
        <TimeEntryFormModal
          organisationId={organisationId}
          onClose={() => setAddingTime(false)}
        />
      )}
    </div>
  );
}
