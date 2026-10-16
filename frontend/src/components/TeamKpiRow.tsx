"use client";

import { useTeamDashboardSummary } from "@/hooks/useTeamDashboardSummary";
import { useProjectsEnabled } from "@/hooks/useProjectsEnabled";
import { formatElapsed } from "@/lib/formatElapsed";
import { DashboardKpiTile } from "./DashboardKpiTile";
import { ErrorMessage } from "./ErrorMessage";
import { Spinner } from "./Spinner";

type TeamKpiRowProps = {
  organisationId: string;
};

export function TeamKpiRow({ organisationId }: TeamKpiRowProps) {
  const projectsEnabled = useProjectsEnabled();
  const summaryQuery = useTeamDashboardSummary(organisationId);

  if (summaryQuery.isLoading) {
    return (
      <p className="flex items-center gap-2 text-slate-900">
        <Spinner className="text-primary-dark" />
        Loading…
      </p>
    );
  }

  if (summaryQuery.isError || !summaryQuery.data) {
    return <ErrorMessage message="Could not load the team's dashboard summary." />;
  }

  const summary = summaryQuery.data;
  const workingCount = summary.members.filter((member) => member.isWorking).length;

  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <DashboardKpiTile
        dotClassName="bg-primary"
        label="Worked this week"
        value={formatElapsed(summary.workedThisWeekSeconds * 1000)}
        deltaLabel={formatElapsed(
          Math.abs(summary.workedThisWeekDeltaSeconds) * 1000,
        )}
        delta={summary.workedThisWeekDeltaSeconds}
      />
      {projectsEnabled && (
        <DashboardKpiTile
          dotClassName="bg-primary"
          label="Active projects"
          value={String(summary.projectsWorkedThisWeek)}
          deltaLabel={String(Math.abs(summary.projectsWorkedDelta))}
          delta={summary.projectsWorkedDelta}
        />
      )}
      <DashboardKpiTile
        dotClassName="bg-primary"
        label="Team members"
        value={String(summary.memberCount)}
        subLabel={workingCount > 0 ? `${workingCount} working now` : undefined}
      />
    </div>
  );
}
