"use client";

import { useSetTaskStage } from "@/hooks/useSetTaskStage";
import type { Task } from "@/types/task";
import { TaskListRow } from "./TaskListRow";

type TaskListViewProps = {
  organisationId: string;
  projectId: string;
  tasks: Task[];
  canManage: boolean;
  isArchived: boolean;
  onOpenTask: (task: Task) => void;
};

export function TaskListView({
  organisationId,
  projectId,
  tasks,
  canManage,
  isArchived,
  onOpenTask,
}: TaskListViewProps) {
  const setStage = useSetTaskStage(organisationId, projectId);

  return (
    <table className="w-full text-left text-sm">
      <thead>
        <tr className="border-b border-input-border text-primary-dark">
          <th className="px-4 py-3 font-semibold">Task</th>
          <th className="hidden px-4 py-3 font-semibold sm:table-cell">Assignee</th>
          <th className="hidden px-4 py-3 font-semibold md:table-cell">Due</th>
          <th className="hidden px-4 py-3 font-semibold md:table-cell">Estimate</th>
          <th className="px-4 py-3 font-semibold">Status</th>
          <th className="px-4 py-3 font-semibold">
            <span className="sr-only">Actions</span>
          </th>
        </tr>
      </thead>
      <tbody>
        {tasks.map((task) => (
          <TaskListRow
            key={task.id}
            task={task}
            canEdit={canManage && !isArchived}
            canMove={!isArchived && (canManage || task.assignedToMe)}
            onEdit={() => onOpenTask(task)}
            onMove={(stage) => setStage.mutate({ taskId: task.id, stage })}
          />
        ))}
        {tasks.length === 0 && (
          <tr>
            <td colSpan={6} className="px-4 py-8 text-center text-slate-900">
              No tasks in this project yet.
            </td>
          </tr>
        )}
      </tbody>
    </table>
  );
}
