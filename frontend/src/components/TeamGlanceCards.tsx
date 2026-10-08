"use client";

import { useTeamDashboardSummary } from "@/hooks/useTeamDashboardSummary";
import { BrandStatCard } from "./BrandStatCard";
import { ErrorMessage } from "./ErrorMessage";
import { Spinner } from "./Spinner";

/** Rows per card — the busiest few, with the card total still covering everything. */
const ROW_LIMIT = 5;

type TeamGlanceCardsProps = {
  organisationId: string;
};

/** Everyone in scope's week as ink stat cards — the same cards the landing page's #features shows. */
export function TeamGlanceCards({ organisationId }: TeamGlanceCardsProps) {
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
    return <ErrorMessage message="Could not load team time at a glance." />;
  }

  const summary = summaryQuery.data;
  const teamsWithTime = summary.teamsThisWeek.filter((team) => team.seconds > 0);

  return (
    <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
      <BrandStatCard
        title="Team hours this week"
        totalSeconds={summary.workedThisWeekSeconds}
        emptyText={
          summary.teamsThisWeek.length === 0
            ? "No teams yet — group people into teams to see their hours here."
            : "No team time this week yet."
        }
        rows={teamsWithTime.slice(0, ROW_LIMIT).map((team) => ({
          key: team.teamId,
          label: team.teamName,
          seconds: team.seconds,
        }))}
      />
      <BrandStatCard
        title="This week by project"
        totalSeconds={summary.workedThisWeekSeconds}
        emptyText="No projects worked on this week yet."
        rows={summary.projectsThisWeek.slice(0, ROW_LIMIT).map((project) => ({
          key: project.projectId,
          label: project.projectName,
          seconds: project.seconds,
        }))}
      />
    </div>
  );
}
