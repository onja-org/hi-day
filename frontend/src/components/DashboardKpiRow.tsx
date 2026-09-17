"use client";

import { useDashboardSummary } from "@/hooks/useDashboardSummary";
import { formatElapsed } from "@/lib/formatElapsed";
import { DashboardKpiTile } from "./DashboardKpiTile";
import { ErrorMessage } from "./ErrorMessage";
import { Spinner } from "./Spinner";

type DashboardKpiRowProps = {
  organisationId: string;
};

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
  const activeDayCount = summary.thisWeekByDay.filter((day) => day.seconds > 0).length;
  const soleProject =
    summary.projectsThisWeek.length === 1 ? summary.projectsThisWeek[0] : undefined;

  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <DashboardKpiTile
        dotClassName="bg-primary"
        label="Worked today"
        value={formatElapsed(summary.workedTodaySeconds * 1000)}
        subLabel={`of ${summary.workingHoursPerDayTarget}h daily target`}
        progressRatio={summary.workedTodaySeconds / (summary.workingHoursPerDayTarget * 3600)}
      />
      <DashboardKpiTile
        dotClassName="bg-primary"
        label="Worked this week"
        value={formatElapsed(summary.workedThisWeekSeconds * 1000)}
        subLabel={
          activeDayCount > 0
            ? `across ${activeDayCount} active day${activeDayCount === 1 ? "" : "s"}`
            : undefined
        }
      />
      <DashboardKpiTile
        dotClassName="bg-primary"
        label="Activity"
        value={
          summary.weeklyActivityPercentage !== null
            ? `${summary.weeklyActivityPercentage}%`
            : "—"
        }
        subLabel="avg keyboard & mouse input"
        progressRatio={
          summary.weeklyActivityPercentage !== null
            ? summary.weeklyActivityPercentage / 100
            : undefined
        }
      />
      <DashboardKpiTile
        dotClassName="bg-primary"
        label="Active projects"
        value={String(summary.projectsWorkedThisWeek)}
        subLabel={soleProject?.projectName}
      />
    </div>
  );
}
