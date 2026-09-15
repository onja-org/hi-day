"use client";

import clsx from "clsx";
import { useTimeEntries } from "@/hooks/useTimeEntries";
import { formatElapsed } from "@/lib/formatElapsed";
import { fractionClass } from "@/lib/fractionClass";
import type { TimesheetDatePreset } from "@/lib/getTimesheetDateRange";
import { getTimesheetDateRange } from "@/lib/getTimesheetDateRange";
import type { ProjectColour } from "@/types/project";
import { ErrorMessage } from "./ErrorMessage";
import { PROJECT_COLOUR_BG_CLASSES } from "./ProjectColourBadge";
import { Spinner } from "./Spinner";

type TimesheetProjectBreakdownProps = {
  organisationId: string;
  membershipId?: string;
  datePreset: TimesheetDatePreset;
};

type ProjectTotal = {
  projectId: string;
  projectName: string;
  projectColour: ProjectColour;
  seconds: number;
};

export function TimesheetProjectBreakdown({
  organisationId,
  membershipId,
  datePreset,
}: TimesheetProjectBreakdownProps) {
  const range = getTimesheetDateRange(datePreset);
  const entriesQuery = useTimeEntries(organisationId, {
    membershipId,
    from: range?.from,
    to: range?.to,
  });

  if (entriesQuery.isLoading) {
    return (
      <p className="flex items-center gap-2 text-slate-900">
        <Spinner className="text-primary-dark" />
        Loading…
      </p>
    );
  }

  if (entriesQuery.isError || !entriesQuery.data) {
    return <ErrorMessage message="Could not load the project breakdown." />;
  }

  const byProject = new Map<string, ProjectTotal>();
  for (const entry of entriesQuery.data) {
    if (entry.durationSeconds === null) continue;
    const existing = byProject.get(entry.projectId);
    if (existing) {
      existing.seconds += entry.durationSeconds;
    } else {
      byProject.set(entry.projectId, {
        projectId: entry.projectId,
        projectName: entry.projectName,
        projectColour: entry.projectColour,
        seconds: entry.durationSeconds,
      });
    }
  }
  const projects = [...byProject.values()].sort((a, b) => b.seconds - a.seconds);
  const maxSeconds = Math.max(...projects.map((project) => project.seconds), 1);

  if (projects.length === 0) {
    return <p className="text-slate-900">No hours logged for this period yet.</p>;
  }

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-input-border p-4">
      {projects.map((project) => (
        <div key={project.projectId} className="flex flex-col gap-1">
          <div className="flex items-center justify-between gap-2 text-sm">
            <span className="text-slate-900">{project.projectName}</span>
            <span className="tabular-nums text-primary-dark">
              {formatElapsed(project.seconds * 1000)}
            </span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-lg bg-sidebar">
            <div
              className={clsx(
                "h-full rounded-lg",
                PROJECT_COLOUR_BG_CLASSES[project.projectColour],
                fractionClass("w", project.seconds / maxSeconds),
              )}
            />
          </div>
        </div>
      ))}
    </div>
  );
}
