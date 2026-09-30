"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { PROJECT_TASKS_QUERY_KEY, useProjectTasks } from "@/hooks/useProjectTasks";
import { closeTask } from "@/lib/closeTask";
import { reopenTask } from "@/lib/reopenTask";
import type { Task } from "@/types/task";
import { ErrorMessage } from "./ErrorMessage";
import { Spinner } from "./Spinner";
import { TaskFormModal } from "./TaskFormModal";
import { TaskStageBadge } from "./TaskStageBadge";

type ProjectTasksSectionProps = {
  organisationId: string;
  projectId: string;
};

export function ProjectTasksSection({
  organisationId,
  projectId,
}: ProjectTasksSectionProps) {
  const queryClient = useQueryClient();
  const tasksQuery = useProjectTasks(organisationId, projectId);
  const [formTask, setFormTask] = useState<Task | "new" | null>(null);

  const invalidate = () =>
    queryClient.invalidateQueries({
      queryKey: PROJECT_TASKS_QUERY_KEY(organisationId, projectId),
    });

  const closeMutation = useMutation({
    mutationFn: (taskId: string) => closeTask(organisationId, projectId, taskId),
    onSuccess: invalidate,
  });

  const reopenMutation = useMutation({
    mutationFn: (taskId: string) => reopenTask(organisationId, projectId, taskId),
    onSuccess: invalidate,
  });

  if (tasksQuery.isLoading) {
    return (
      <p className="flex items-center gap-2 text-slate-900">
        <Spinner className="text-primary-dark" />
        Loading tasks…
      </p>
    );
  }

  if (tasksQuery.isError || !tasksQuery.data) {
    return (
      <ErrorMessage
        message={
          tasksQuery.error instanceof Error
            ? tasksQuery.error.message
            : "Could not load tasks."
        }
      />
    );
  }

  const { tasks, canManage, project } = tasksQuery.data;
  const isArchived = project.status === "archived";
  const isTogglingStatus = closeMutation.isPending || reopenMutation.isPending;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-4">
        <h2 className="text-lg font-semibold text-primary-dark">Tasks</h2>
        {canManage && (
          <button
            type="button"
            onClick={() => setFormTask("new")}
            disabled={isArchived}
            title={isArchived ? "Unarchive this project to add tasks." : undefined}
            className="cursor-pointer rounded-md border border-primary px-3 h-11 text-sm text-primary transition-colors duration-150 hover:bg-primary/10 disabled:cursor-not-allowed disabled:opacity-50"
          >
            New task
          </button>
        )}
      </div>

      <div className="overflow-x-auto rounded-md border border-input-border">
        <table className="w-full min-w-[560px] text-left text-sm">
          <thead>
            <tr className="border-b border-input-border text-slate-900">
              <th className="px-3 py-2 font-medium">Task</th>
              <th className="px-3 py-2 font-medium">Assignee</th>
              <th className="px-3 py-2 font-medium">Due</th>
              <th className="px-3 py-2 font-medium">Status</th>
              <th className="px-3 py-2 font-medium" />
            </tr>
          </thead>
          <tbody>
            {tasks.map((task) => {
              const canToggleStatus = canManage || task.assignedToMe;
              return (
                <tr key={task.id} className="border-b border-input-border last:border-b-0">
                  <td className="px-3 py-2 text-slate-900">
                    {canManage ? (
                      <button
                        type="button"
                        onClick={() => setFormTask(task)}
                        className="cursor-pointer text-left underline-offset-2 hover:underline"
                      >
                        {task.name}
                      </button>
                    ) : (
                      task.name
                    )}
                    {task.estimate && (
                      <span className="block text-xs text-slate-900/70">
                        {task.estimate}h estimated
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-slate-900">
                    {task.assignee ? task.assignee.name ?? task.assignee.email : "Unassigned"}
                  </td>
                  <td className="px-3 py-2 text-slate-900">{task.dueDate ?? "—"}</td>
                  <td className="px-3 py-2">
                    <TaskStageBadge stage={task.stage} />
                  </td>
                  <td className="px-3 py-2 text-right">
                    {canToggleStatus && !isArchived && (
                      <button
                        type="button"
                        onClick={() =>
                          task.status === "open"
                            ? closeMutation.mutate(task.id)
                            : reopenMutation.mutate(task.id)
                        }
                        disabled={isTogglingStatus}
                        className="cursor-pointer text-primary underline disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {task.status === "open" ? "Close" : "Reopen"}
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
            {tasks.length === 0 && (
              <tr>
                <td colSpan={5} className="px-3 py-4 text-center text-slate-900">
                  No tasks yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {formTask && (
        <TaskFormModal
          organisationId={organisationId}
          projectId={projectId}
          task={formTask === "new" ? undefined : formTask}
          onClose={() => setFormTask(null)}
          onSaved={() => setFormTask(null)}
        />
      )}
    </div>
  );
}
