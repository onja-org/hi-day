"use client";

import { useProjectTasks } from "@/hooks/useProjectTasks";
import type { Task } from "@/types/task";
import { Modal } from "./Modal";
import { TaskForm } from "./TaskForm";
import { TaskStageSelect } from "./TaskStageSelect";

type TaskDetailModalProps = {
  organisationId: string;
  task: Task;
  canManage: boolean;
  canMove: boolean;
  onClose: () => void;
};

/**
 * Opening a task: its status (changeable by anyone who can move it) and
 * then either the full edit form (project admins) or its details, read-only.
 */
export function TaskDetailModal({ organisationId, task, canManage, canMove, onClose }: TaskDetailModalProps) {
  // Read the live copy so a status change shows straight away.
  const tasksQuery = useProjectTasks(organisationId, task.projectId);
  const current = tasksQuery.data?.tasks.find((t) => t.id === task.id) ?? task;
  const assigneeLabel = current.assignee ? (current.assignee.name ?? current.assignee.email) : "Unassigned";

  return (
    <Modal title={canManage ? "Edit task" : current.name} onClose={onClose}>
      <div className="flex flex-col gap-6">
        <TaskStageSelect organisationId={organisationId} task={current} editable={canMove} />
        {canManage ? (
          <TaskForm
            organisationId={organisationId}
            projectId={current.projectId}
            mode="edit"
            task={current}
            onSaved={onClose}
          />
        ) : (
          <dl className="grid grid-cols-3 gap-x-4 gap-y-3 text-sm">
            <dt className="text-slate-900/60">Assignee</dt>
            <dd className="col-span-2 text-slate-900">{assigneeLabel}</dd>
            <dt className="text-slate-900/60">Due</dt>
            <dd className="col-span-2 text-slate-900">{current.dueDate ?? "—"}</dd>
            <dt className="text-slate-900/60">Estimate</dt>
            <dd className="col-span-2 text-slate-900">{current.estimate ? `${current.estimate}h` : "—"}</dd>
            <dt className="text-slate-900/60">Description</dt>
            <dd className="col-span-2 whitespace-pre-wrap text-slate-900">{current.description ?? "—"}</dd>
          </dl>
        )}
      </div>
    </Modal>
  );
}
