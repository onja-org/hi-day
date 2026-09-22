"use client";

import clsx from "clsx";
import Link from "next/link";
import { useTeamDashboardSummary } from "@/hooks/useTeamDashboardSummary";
import { formatElapsed } from "@/lib/formatElapsed";
import { fractionClass } from "@/lib/fractionClass";
import { ErrorMessage } from "./ErrorMessage";
import { ProjectColourBadge } from "./ProjectColourBadge";
import { Spinner } from "./Spinner";

type TeamProjectActivityProps = {
  organisationId: string;
};

export function TeamProjectActivity({ organisationId }: TeamProjectActivityProps) {
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
    return <ErrorMessage message="Could not load the team's project activity." />;
  }

  const projects = summaryQuery.data.projectsThisWeek;
  const maxSeconds = Math.max(...projects.map((project) => project.seconds), 1);
  const weekTotalSeconds = projects.reduce((sum, project) => sum + project.seconds, 0);

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-input-border p-4">
      {projects.length === 0 ? (
        <p className="text-slate-900">No projects worked on this week yet.</p>
      ) : (
        <div className="flex flex-col gap-3">
          {projects.map((project) => {
            const weekShare =
              weekTotalSeconds > 0
                ? Math.round((project.seconds / weekTotalSeconds) * 100)
                : 0;
            return (
              <div key={project.projectId} className="flex flex-col gap-1">
                <div className="flex items-center justify-between gap-2 text-sm">
                  <Link
                    href={`/organisations/${organisationId}/projects/${project.projectId}`}
                    className="flex items-center gap-2 text-slate-900 hover:text-primary"
                  >
                    <ProjectColourBadge colour={project.projectColour} />
                    {project.projectName}
                  </Link>
                  <span className="tabular-nums text-primary-dark">
                    {formatElapsed(project.seconds * 1000)}
                  </span>
                </div>
                <div className="h-1 w-full overflow-hidden rounded-lg bg-sidebar">
                  <div
                    className={clsx(
                      "h-full rounded-lg bg-primary",
                      fractionClass("w", project.seconds / maxSeconds),
                    )}
                  />
                </div>
                <span className="text-xs text-slate-900/60">
                  {weekShare}% of this week, across the team
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
