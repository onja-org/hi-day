"use client";

import { useCurrentOrganisation } from "@/hooks/useCurrentOrganisation";
import { useTimeEntries } from "@/hooks/useTimeEntries";
import { formatDuration } from "@/lib/formatDuration";
import { formatElapsed } from "@/lib/formatElapsed";
import { groupTimeEntriesByDay } from "@/lib/groupTimeEntriesByDay";
import type { TimesheetDatePreset } from "@/lib/getTimesheetDateRange";
import { getTimesheetDateRange } from "@/lib/getTimesheetDateRange";
import { DashboardKpiTile } from "./DashboardKpiTile";
import { ErrorMessage } from "./ErrorMessage";
import { Spinner } from "./Spinner";

// A daily-hours target only makes sense as a comparison for a single-day
// view — "12h of 8h target" for a whole week/month would be misleading.
const SINGLE_DAY_PRESETS: TimesheetDatePreset[] = ["today", "yesterday"];

type TimesheetSummaryTilesProps = {
  organisationId: string;
  membershipId?: string;
  datePreset: TimesheetDatePreset;
};

export function TimesheetSummaryTiles({
  organisationId,
  membershipId,
  datePreset,
}: TimesheetSummaryTilesProps) {
  const range = getTimesheetDateRange(datePreset);
  const entriesQuery = useTimeEntries(organisationId, {
    membershipId,
    from: range?.from,
    to: range?.to,
  });
  const organisationQuery = useCurrentOrganisation();

  if (entriesQuery.isLoading) {
    return (
      <p className="flex items-center gap-2 text-slate-900">
        <Spinner className="text-primary-dark" />
        Loading…
      </p>
    );
  }

  if (entriesQuery.isError || !entriesQuery.data) {
    return <ErrorMessage message="Could not load this timesheet's summary." />;
  }

  const entries = entriesQuery.data;
  const dayGroups = groupTimeEntriesByDay(entries);
  const totalSeconds = dayGroups.reduce((sum, group) => sum + group.totalSeconds, 0);
  const averageSecondsPerDay =
    dayGroups.length > 0 ? totalSeconds / dayGroups.length : 0;
  const projectCount = new Set(entries.map((entry) => entry.projectId)).size;
  const hasRunningEntry = entries.some((entry) => entry.durationSeconds === null);
  const dailyTarget = organisationQuery.data?.workingHoursPerDay;
  const showDailyTarget =
    dailyTarget !== undefined && SINGLE_DAY_PRESETS.includes(datePreset);

  return (
    <div className="flex flex-col gap-2">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <DashboardKpiTile
          label="Total hours"
          value={formatElapsed(totalSeconds * 1000)}
          subLabel={showDailyTarget ? `of ${dailyTarget}h target` : undefined}
        />
        <DashboardKpiTile
          label="Avg / day worked"
          value={formatDuration(Math.round(averageSecondsPerDay / 60))}
        />
        <DashboardKpiTile label="Entries logged" value={String(entries.length)} />
        <DashboardKpiTile label="Projects worked" value={String(projectCount)} />
      </div>
      {hasRunningEntry && (
        <p className="text-xs text-slate-900/60">
          Totals above exclude the entry still in progress.
        </p>
      )}
    </div>
  );
}
