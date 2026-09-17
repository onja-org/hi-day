"use client";

import clsx from "clsx";
import { useDashboardSummary } from "@/hooks/useDashboardSummary";
import { formatElapsed } from "@/lib/formatElapsed";
import { fractionClass } from "@/lib/fractionClass";
import { ErrorMessage } from "./ErrorMessage";
import { ProjectColourBadge } from "./ProjectColourBadge";
import { Spinner } from "./Spinner";

type CurrentProjectActivityProps = {
  organisationId: string;
};

export function CurrentProjectActivity({
  organisationId,
}: CurrentProjectActivityProps) {
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
    return <ErrorMessage message="Could not load your project activity." />;
  }

  const { projectsThisWeek: projects, projectsToday } = summaryQuery.data;
  const maxSeconds = Math.max(...projects.map((project) => project.seconds), 1);
  const weekTotalSeconds = projects.reduce((sum, project) => sum + project.seconds, 0);
  const todayByProjectId = new Map(
    projectsToday.map((project) => [project.projectId, project.seconds]),
  );

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-input-border p-4">
      {projects.length === 0 ? (
        <p className="text-slate-900">No projects worked on this week yet.</p>
      ) : (
        <div className="flex flex-col gap-3">
          {projects.map((project) => {
            const weekShare =
              weekTotalSeconds > 0 ? Math.round((project.seconds / weekTotalSeconds) * 100) : 0;
            const todaySeconds = todayByProjectId.get(project.projectId) ?? 0;
            return (
              <div key={project.projectId} className="flex flex-col gap-1">
                <div className="flex items-center justify-between gap-2 text-sm">
                  <span className="flex items-center gap-2 text-slate-900">
                    <ProjectColourBadge colour={project.projectColour} />
                    {project.projectName}
                  </span>
                  <span className="tabular-nums text-primary-dark">
                    {formatElapsed(project.seconds * 1000)}
                  </span>
                </div>
                <div className="h-1.5 w-full overflow-hidden rounded-lg bg-sidebar">
                  <div
                    className={clsx(
                      "h-full rounded-lg bg-primary",
                      fractionClass("w", project.seconds / maxSeconds),
                    )}
                  />
                </div>
                <div className="flex items-center justify-between gap-2 text-xs text-slate-900/60">
                  <span>{weekShare}% of this week</span>
                  {todaySeconds > 0 && <span>{formatElapsed(todaySeconds * 1000)} today</span>}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
