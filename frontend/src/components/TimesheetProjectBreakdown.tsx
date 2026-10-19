"use client";

import clsx from "clsx";
import { formatElapsed } from "@/lib/formatElapsed";
import { fractionClass } from "@/lib/fractionClass";
import type { ProjectColour } from "@/types/project";
import type { TimeEntryListItem } from "@/types/timeEntry";
import { entryProjectColour, entryProjectName } from "@/lib/entryProjectDisplay";
import { PROJECT_COLOUR_BG_CLASSES } from "./ProjectColourBadge";

type TimesheetProjectBreakdownProps = {
  entries: TimeEntryListItem[];
};

type ProjectTotal = {
  projectId: string;
  projectName: string;
  projectColour: ProjectColour;
  seconds: number;
};

export function TimesheetProjectBreakdown({ entries }: TimesheetProjectBreakdownProps) {
  const byProject = new Map<string, ProjectTotal>();
  for (const entry of entries) {
    if (entry.durationSeconds === null || entry.projectId === null) continue;
    const existing = byProject.get(entry.projectId);
    if (existing) {
      existing.seconds += entry.durationSeconds;
    } else {
      byProject.set(entry.projectId, {
        projectId: entry.projectId,
        projectName: entryProjectName(entry),
        projectColour: entryProjectColour(entry),
        seconds: entry.durationSeconds,
      });
    }
  }
  const projects = [...byProject.values()].sort((a, b) => b.seconds - a.seconds);
  const maxSeconds = Math.max(...projects.map((project) => project.seconds), 1);

  // With zero or one project, this would only repeat the "Total hours" tile
  // (or an empty state already covered by the entries table below) — a
  // breakdown only earns its place once there's more than one project to
  // compare.
  if (projects.length <= 1) {
    return null;
  }

  return (
    <div className="flex flex-col gap-2">
      <h2 className="text-lg font-semibold text-primary-dark">By project</h2>
      <div className="flex flex-col gap-3 rounded-lg border border-input-border p-4">
        {projects.map((project) => (
          <div key={project.projectId} className="flex flex-col gap-1">
            <div className="flex items-center justify-between gap-2 text-sm">
              <span className="text-slate-900">{project.projectName}</span>
              <span className="tabular-nums text-primary-dark">
                {formatElapsed(project.seconds * 1000)}
              </span>
            </div>
            <div className="h-1 w-full overflow-hidden rounded-lg bg-sidebar">
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
    </div>
  );
}
