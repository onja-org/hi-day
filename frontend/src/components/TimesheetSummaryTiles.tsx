"use client";

import { useCurrentOrganisation } from "@/hooks/useCurrentOrganisation";
import { formatDuration } from "@/lib/formatDuration";
import { formatElapsed } from "@/lib/formatElapsed";
import { groupTimeEntriesByDay } from "@/lib/groupTimeEntriesByDay";
import type { TimeEntryListItem } from "@/types/timeEntry";
import { DashboardKpiTile } from "./DashboardKpiTile";

type TimesheetSummaryTilesProps = {
  entries: TimeEntryListItem[];
  /** True when the viewed range covers one day — a daily-hours target only
   * makes sense as a comparison then; "12h of 8h target" for a whole
   * week/month would be misleading. */
  isSingleDay: boolean;
};

export function TimesheetSummaryTiles({ entries, isSingleDay }: TimesheetSummaryTilesProps) {
  const organisationQuery = useCurrentOrganisation();
  const dayGroups = groupTimeEntriesByDay(entries);
  const totalSeconds = dayGroups.reduce((sum, group) => sum + group.totalSeconds, 0);
  const averageSecondsPerDay =
    dayGroups.length > 0 ? totalSeconds / dayGroups.length : 0;
  const projects = new Map(entries.map((entry) => [entry.projectId, entry]));
  const hasRunningEntry = entries.some((entry) => entry.durationSeconds === null);
  const dailyTarget = organisationQuery.data?.workingHoursPerDay;
  const showDailyTarget =
    dailyTarget !== undefined && isSingleDay;
  const entriesUnderMinute = entries.filter(
    (entry) => entry.durationSeconds !== null && entry.durationSeconds < 60,
  ).length;
  const soleProject = projects.size === 1 ? [...projects.values()][0] : undefined;

  return (
    <div className="flex flex-col gap-2">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <DashboardKpiTile
          dotClassName="bg-primary"
          label="Total hours"
          value={formatElapsed(totalSeconds * 1000)}
          subLabel={
            showDailyTarget
              ? `of ${dailyTarget}h target`
              : dayGroups.length > 0
                ? `across ${dayGroups.length} active day${dayGroups.length === 1 ? "" : "s"}`
                : undefined
          }
        />
        <DashboardKpiTile
          dotClassName="bg-primary"
          label="Avg / day worked"
          value={formatDuration(Math.round(averageSecondsPerDay / 60))}
          subLabel={dayGroups.length > 0 ? "on days you tracked" : undefined}
        />
        <DashboardKpiTile
          dotClassName="bg-primary"
          label="Entries logged"
          value={String(entries.length)}
          subLabel={entriesUnderMinute > 0 ? `${entriesUnderMinute} under a minute` : undefined}
        />
        <DashboardKpiTile
          dotClassName="bg-primary"
          label="Projects worked"
          value={String(projects.size)}
          subLabel={soleProject ? soleProject.projectName : undefined}
        />
      </div>
      {hasRunningEntry && (
        <p className="text-xs text-slate-900/60">
          Totals above exclude the entry still in progress.
        </p>
      )}
    </div>
  );
}
