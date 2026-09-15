"use client";

import { useDashboardSummary } from "@/hooks/useDashboardSummary";
import { formatElapsed } from "@/lib/formatElapsed";
import { DashboardKpiTile } from "./DashboardKpiTile";
import { ErrorMessage } from "./ErrorMessage";
import { Spinner } from "./Spinner";

type DashboardKpiRowProps = {
  organisationId: string;
};

function formatDelta(seconds: number): string {
  return `${seconds < 0 ? "-" : ""}${formatElapsed(Math.abs(seconds) * 1000)}`;
}

export function DashboardKpiRow({ organisationId }: DashboardKpiRowProps) {
  const summaryQuery = useDashboardSummary(organisationId);

  if (summaryQuery.isLoading) {
    return (
      <p className="flex items-center gap-2 text-slate-900">
        <Spinner className="text-primary-dark" />
        Loading…
      </p>
    );
  }

  if (summaryQuery.isError || !summaryQuery.data) {
    return <ErrorMessage message="Could not load your dashboard summary." />;
  }

  const summary = summaryQuery.data;
  const weekTrend = summary.thisWeekByDay.map((day) => day.seconds);

  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <DashboardKpiTile
        label="Weekly activity"
        value={
          summary.weeklyActivityPercentage !== null
            ? `${summary.weeklyActivityPercentage}%`
            : "—"
        }
        deltaLabel={
          summary.weeklyActivityDeltaPercentage !== null
            ? `${Math.abs(summary.weeklyActivityDeltaPercentage)}%`
            : undefined
        }
        delta={summary.weeklyActivityDeltaPercentage ?? undefined}
      />
      <DashboardKpiTile
        label="Worked this week"
        value={formatElapsed(summary.workedThisWeekSeconds * 1000)}
        deltaLabel={formatDelta(summary.workedThisWeekDeltaSeconds)}
        delta={summary.workedThisWeekDeltaSeconds}
        sparkline={weekTrend}
      />
      <DashboardKpiTile
        label="Projects worked"
        value={String(summary.projectsWorkedThisWeek)}
        deltaLabel={`${Math.abs(summary.projectsWorkedDelta)}`}
        delta={summary.projectsWorkedDelta}
      />
      <DashboardKpiTile
        label="Worked today"
        value={formatElapsed(summary.workedTodaySeconds * 1000)}
        deltaLabel={formatDelta(summary.workedTodayDeltaSeconds)}
        delta={summary.workedTodayDeltaSeconds}
        sparkline={weekTrend}
      />
    </div>
  );
}
