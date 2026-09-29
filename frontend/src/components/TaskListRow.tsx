"use client";

import { getInitials } from "@/lib/getInitials";
import { TASK_STAGES } from "@/lib/taskStages";
import type { Task, TaskStage } from "@/types/task";
import { ActionsMenu } from "./ActionsMenu";
import { TaskStageBadge } from "./TaskStageBadge";

type TaskListRowProps = {
  task: Task;
  canEdit: boolean;
  canMove: boolean;
  onEdit: () => void;
  onMove: (stage: TaskStage) => void;
};

export function TaskListRow({ task, canEdit, canMove, onEdit, onMove }: TaskListRowProps) {
  const assigneeLabel = task.assignee ? (task.assignee.name ?? task.assignee.email) : null;
  const moveItems = TASK_STAGES.filter(({ stage }) => stage !== task.stage).map(({ stage, label }) => ({
    label: `Move to ${label}`,
    onSelect: () => onMove(stage),
  }));

  return (
    <tr className="border-b border-input-border last:border-b-0 hover:bg-cream/30">
      <td className="px-4 py-3">
        <span className="font-medium text-slate-900">{task.name}</span>
        {task.description && (
          <span className="block max-w-md truncate text-xs text-slate-900/60">{task.description}</span>
        )}
      </td>
      <td className="hidden px-4 py-3 sm:table-cell">
        {assigneeLabel ? (
          <span className="flex items-center gap-2 text-slate-900">
            <span
              aria-hidden="true"
              className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-semibold text-white"
            >
              {getInitials(task.assignee?.name ?? null, task.assignee?.email)}
            </span>
            <span className="truncate">{assigneeLabel}</span>
          </span>
        ) : (
          <span className="text-slate-900/60">Unassigned</span>
        )}
      </td>
      <td className="hidden px-4 py-3 whitespace-nowrap text-slate-900 md:table-cell">{task.dueDate ?? "—"}</td>
      <td className="hidden px-4 py-3 text-slate-900 md:table-cell">{task.estimate ? `${task.estimate}h` : "—"}</td>
      <td className="px-4 py-3">
        <TaskStageBadge stage={task.stage} />
      </td>
      <td className="px-4 py-3 text-right whitespace-nowrap">
        {(canEdit || canMove) && (
          <ActionsMenu
            items={[
              ...(canEdit ? [{ label: "Edit task", onSelect: onEdit }] : []),
              ...(canMove ? moveItems : []),
            ]}
          />
        )}
      </td>
    </tr>
  );
}
