"use client";

import { ArrowsClockwiseIcon, PlayIcon } from "@phosphor-icons/react";
import clsx from "clsx";
import { useProjectTasks } from "@/hooks/useProjectTasks";
import { formatElapsed } from "@/lib/formatElapsed";
import type { ProjectListItem } from "@/types/project";
import { ErrorMessage } from "./ErrorMessage";

type TimerPickerProps = {
  organisationId: string;
  projects: ProjectListItem[];
  projectId: string;
  taskId: string;
  /** Today's already-tracked seconds per project (completed entries only) —
   * see useRunningTimer's projectSecondsToday. Previews how much a project
   * has today before its timer is even started. */
  projectSecondsToday: Map<string, number>;
  conflictMessage: string | null;
  isStarting: boolean;
  isSwitching: boolean;
  onProjectChange: (projectId: string) => void;
  onTaskChange: (taskId: string) => void;
  onStart: () => void;
  onSwitch: () => void;
  /**
   * "row" (default) lets the fields sit side by side once the *viewport*
   * crosses the `sm:` breakpoint — right for the dashboard's full-width
   * card. Tailwind's responsive prefixes key off viewport width, not the
   * element's own width, so a narrow container (the header popover) needs
   * "stacked" instead, or it'd try to lay three fields out in ~300px on
   * any desktop-width browser window regardless of the popover's size.
   */
  layout?: "row" | "stacked";
};

export function TimerPicker({
  organisationId,
  projects,
  projectId,
  taskId,
  projectSecondsToday,
  conflictMessage,
  isStarting,
  isSwitching,
  onProjectChange,
  onTaskChange,
  onStart,
  onSwitch,
  layout = "row",
}: TimerPickerProps) {
  const tasksQuery = useProjectTasks(organisationId, projectId, {
    enabled: projectId !== "",
  });
  const tasks = tasksQuery.data?.tasks.filter((task) => task.status === "open") ?? [];
  const selectedProjectSecondsToday = projectId
    ? (projectSecondsToday.get(projectId) ?? 0)
    : 0;

  if (projects.length === 0) {
    return (
      <p className="text-slate-900">
        You&apos;re not on any Project yet — ask an admin to add you to one.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {conflictMessage && (
        <div className="flex flex-col gap-2">
          <ErrorMessage message={conflictMessage} />
          <button
            type="button"
            onClick={onSwitch}
            disabled={isSwitching}
            className="flex cursor-pointer items-center justify-center gap-2 self-start rounded-md bg-secondary px-4 py-2 text-white transition-colors duration-150 hover:bg-secondary/90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <ArrowsClockwiseIcon size={16} aria-hidden="true" />
            Stop the other timer and start this one
          </button>
        </div>
      )}

      <div
        className={clsx(
          "flex flex-col gap-3",
          layout === "row" && "sm:flex-row sm:items-end",
        )}
      >
        <label className="flex flex-1 flex-col gap-1">
          <span className="text-xs font-medium text-slate-900/70">Project</span>
          <select
            value={projectId}
            onChange={(event) => onProjectChange(event.target.value)}
            className="rounded-md border border-input-border bg-white px-3 py-2 text-sm text-slate-900"
          >
            <option value="">Select a project…</option>
            {projects.map((project) => (
              <option key={project.id} value={project.id}>
                {project.name}
              </option>
            ))}
          </select>
          {projectId && selectedProjectSecondsToday > 0 && (
            <span className="text-xs text-slate-900/70">
              {formatElapsed(selectedProjectSecondsToday * 1000)} tracked today
            </span>
          )}
        </label>

        <label className="flex flex-1 flex-col gap-1">
          <span className="text-xs font-medium text-slate-900/70">Task (optional)</span>
          <select
            value={taskId}
            onChange={(event) => onTaskChange(event.target.value)}
            disabled={!projectId}
            className="rounded-md border border-input-border bg-white px-3 py-2 text-sm text-slate-900 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <option value="">No task</option>
            {tasks.map((task) => (
              <option key={task.id} value={task.id}>
                {task.name}
              </option>
            ))}
          </select>
        </label>

        <button
          type="button"
          onClick={onStart}
          disabled={!projectId || isStarting}
          className={clsx(
            "flex cursor-pointer items-center justify-center gap-2 rounded-md bg-primary px-5 py-2 text-white transition-colors duration-150 hover:bg-primary/90 disabled:cursor-not-allowed disabled:bg-primary/50",
            layout === "stacked" && "w-full",
          )}
        >
          <PlayIcon size={16} weight="fill" aria-hidden="true" />
          Start timer
        </button>
      </div>
    </div>
  );
}
