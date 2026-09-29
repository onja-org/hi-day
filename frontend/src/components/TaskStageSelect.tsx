"use client";

import clsx from "clsx";
import { useSetTaskStage } from "@/hooks/useSetTaskStage";
import { TASK_STAGES } from "@/lib/taskStages";
import type { Task } from "@/types/task";

type TaskStageSelectProps = {
  organisationId: string;
  task: Task;
  /** The caller may move this task (a project admin, or its assignee). */
  editable: boolean;
};

/** The task's status as a row of choices; picking one moves it straight
 * away (same request as dragging its Kanban card). */
export function TaskStageSelect({ organisationId, task, editable }: TaskStageSelectProps) {
  const setStage = useSetTaskStage(organisationId, task.projectId);

  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-2 text-sm text-slate-900">Status</legend>
      <div className="flex flex-wrap gap-2">
        {TASK_STAGES.map(({ stage, label }) => {
          const selected = task.stage === stage;
          return (
            <button
              key={stage}
              type="button"
              aria-pressed={selected}
              disabled={!editable || setStage.isPending}
              onClick={() => !selected && setStage.mutate({ taskId: task.id, stage })}
              className={clsx(
                "rounded-full border px-4 py-1.5 text-sm font-medium transition-colors duration-150 disabled:cursor-not-allowed",
                selected && "border-primary bg-primary text-white",
                !selected && "border-input-border text-slate-900",
                !selected && editable && "cursor-pointer hover:border-primary hover:text-primary",
                !editable && !selected && "opacity-50",
              )}
            >
              {label}
            </button>
          );
        })}
      </div>
      {!editable && (
        <p className="text-xs text-slate-900/60">
          Only this task&apos;s assignee or a project manager can change its status.
        </p>
      )}
    </fieldset>
  );
}
