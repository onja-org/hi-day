"use client";

import { ArrowsClockwiseIcon, PlayIcon } from "@phosphor-icons/react";
import clsx from "clsx";
import Link from "next/link";
import { useCurrentOrganisation } from "@/hooks/useCurrentOrganisation";
import { useProjectTasks } from "@/hooks/useProjectTasks";
import { formatElapsed } from "@/lib/formatElapsed";
import type { ProjectListItem } from "@/types/project";
import { ErrorMessage } from "@/components/ErrorMessage";
import { InfoMessage } from "@/components/InfoMessage";
import { SelectField } from "@/components/ui/form/SelectField";

type TimerPickerProps = {
  organisationId: string;
  projects: ProjectListItem[];
  projectId: string;
  taskId: string;
  projectSecondsToday: Map<string, number>;
  conflictMessage: string | null;
  /** Whether the conflict is one switching can resolve (a web timer elsewhere). */
  canSwitch: boolean;
  /** Set when this organisation tracks from another client; blocks Start. */
  trackingNotice: string | null;
  /** The only startable Project; the rest are shown disabled, so a narrowed
   * list never reads as projects having gone missing. */
  requiredProjectId: string | null;
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
  canSwitch,
  trackingNotice,
  requiredProjectId,
  isStarting,
  isSwitching,
  onProjectChange,
  onTaskChange,
  onStart,
  onSwitch,
  layout = "row",
}: TimerPickerProps) {
  const organisationQuery = useCurrentOrganisation();
  const tasksQuery = useProjectTasks(organisationId, projectId, {
    enabled: projectId !== "",
  });
  const tasks =
    tasksQuery.data?.tasks.filter((task) => task.status === "open") ?? [];
  const selectedProjectSecondsToday = projectId
    ? (projectSecondsToday.get(projectId) ?? 0)
    : 0;

  if (projects.length === 0) {
    // An admin's list is every active Project in the organisation, so an
    // empty one means there's nothing to join — they need to create one.
    if (organisationQuery.data?.role === "admin") {
      return (
        <p className="text-slate-900">
          There are no Projects yet —{" "}
          <Link
            href={`/organisations/${organisationId}/projects`}
            className="text-primary underline hover:text-primary/80"
          >
            create a project
          </Link>{" "}
          to start tracking time.
        </p>
      );
    }
    return (
      <p className="text-slate-900">
        You&apos;re not on any Project yet — ask an admin to add you to one.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {trackingNotice && <InfoMessage message={trackingNotice} />}

      {conflictMessage && (
        <div className="flex flex-col gap-2">
          <ErrorMessage message={conflictMessage} />
          {canSwitch && (
            <button
              type="button"
              onClick={onSwitch}
              disabled={isSwitching}
              className="flex cursor-pointer items-center justify-center gap-2 self-start rounded-brand-sm border-2 border-ink bg-secondary px-4 h-11 text-white transition-colors duration-150 hover:bg-secondary/90 disabled:cursor-not-allowed disabled:opacity-50 font-bold"
            >
              <ArrowsClockwiseIcon size={16} aria-hidden="true" />
              Stop the other timer and start this one
            </button>
          )}
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
              <option
                key={project.id}
                value={project.id}
                disabled={
                  requiredProjectId !== null && project.id !== requiredProjectId
                }
              >
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
          disabled={!projectId || isStarting || trackingNotice !== null}
          className={clsx(
            "flex cursor-pointer items-center justify-center gap-2 rounded-brand-sm bg-primary px-5 h-11 text-white transition-colors duration-150 hover:bg-primary/90 disabled:cursor-not-allowed disabled:bg-primary/50 border-2 border-ink font-bold",
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
