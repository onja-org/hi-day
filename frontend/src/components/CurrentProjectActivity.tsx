"use client";

import clsx from "clsx";
import Link from "next/link";
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

  const projects = summaryQuery.data.projectsThisWeek;
  const maxSeconds = Math.max(...projects.map((project) => project.seconds), 1);

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-input-border p-4">
      {projects.length === 0 ? (
        <p className="text-slate-900">No projects worked on this week yet.</p>
      ) : (
        <div className="flex flex-col gap-3">
          {projects.map((project) => (
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
            </div>
          ))}
        </div>
      )}

      <Link
        href={`/organisations/${organisationId}/projects`}
        className="self-start text-sm text-primary underline-offset-2 hover:underline"
      >
        View projects →
      </Link>
    </div>
  );
}
