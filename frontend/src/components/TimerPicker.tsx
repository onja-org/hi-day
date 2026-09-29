"use client";

import { ArrowsClockwiseIcon, PlayIcon } from "@phosphor-icons/react";
import clsx from "clsx";
import { useProjectTasks } from "@/hooks/useProjectTasks";
import { formatElapsed } from "@/lib/formatElapsed";
import type { ProjectListItem } from "@/types/project";
import { ErrorMessage } from "@/components/ErrorMessage";
import { SelectField } from "@/components/ui/form/SelectField";

type TimerPickerProps = {
  organisationId: string;
  projects: ProjectListItem[];
  projectId: string;
  taskId: string;
  projectSecondsToday: Map<string, number>;
  conflictMessage: string | null;
  isStarting: boolean;
  isSwitching: boolean;
  onProjectChange: (projectId: string) => void;
  onTaskChange: (taskId: string) => void;
  onStart: () => void;
  onSwitch: () => void;
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
  const tasks =
    tasksQuery.data?.tasks.filter((task) => task.status === "open") ?? [];
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
        <div className="flex flex-1 flex-col gap-1">
          <SelectField
            label="Project"
            compact
            value={projectId}
            onChange={(event) => onProjectChange(event.target.value)}
          >
            <option value="">Select a project…</option>
            {projects.map((project) => (
              <option key={project.id} value={project.id}>
                {project.name}
              </option>
            ))}
          </SelectField>
          {projectId && selectedProjectSecondsToday > 0 && (
            <span className="text-xs text-slate-900/70">
              {formatElapsed(selectedProjectSecondsToday * 1000)} tracked today
            </span>
          )}
        </div>

        <SelectField
          label="Task (optional)"
          compact
          className="flex-1"
          value={taskId}
          onChange={(event) => onTaskChange(event.target.value)}
          disabled={!projectId}
        >
          <option value="">No task</option>
          {tasks.map((task) => (
            <option key={task.id} value={task.id}>
              {task.name}
            </option>
          ))}
        </SelectField>

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
