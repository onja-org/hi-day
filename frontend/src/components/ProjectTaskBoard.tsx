"use client";

import { useState } from "react";
import { useProjectTasks } from "@/hooks/useProjectTasks";
import type { Task } from "@/types/task";
import { ErrorMessage } from "./ErrorMessage";
import { Spinner } from "./Spinner";
import { TaskFormModal } from "./TaskFormModal";
import { TaskKanbanBoard } from "./TaskKanbanBoard";
import { TaskListView } from "./TaskListView";

type ProjectTaskBoardProps = {
  organisationId: string;
  projectId: string;
  view: "list" | "kanban";
};

/** One project's tasks as a list or a Kanban board. Only a project admin
 * gets "Add task" and editing; anyone else can move just the tasks
 * assigned to them (the backend enforces the same). */
export function ProjectTaskBoard({ organisationId, projectId, view }: ProjectTaskBoardProps) {
  const tasksQuery = useProjectTasks(organisationId, projectId);
  const [formTask, setFormTask] = useState<Task | "new" | null>(null);

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
        message={tasksQuery.error instanceof Error ? tasksQuery.error.message : "Could not load tasks."}
      />
    );
  }

  const { tasks, canManage, project } = tasksQuery.data;
  const isArchived = project.status === "archived";
  const viewProps = {
    organisationId,
    projectId,
    tasks,
    canManage,
    isArchived,
    onOpenTask: (task: Task) => setFormTask(task),
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex min-h-9 items-center justify-between gap-4">
        <p className="text-sm text-slate-900/70">
          {canManage
            ? "Drag cards by their handle to change status."
            : "You can move the tasks assigned to you."}
        </p>
        {canManage && !isArchived && (
          <button
            type="button"
            onClick={() => setFormTask("new")}
            className="shrink-0 cursor-pointer rounded-md bg-primary px-5 py-2 text-sm font-medium text-white transition-colors duration-150 hover:bg-primary/90"
          >
            Add task
          </button>
        )}
      </div>

      {view === "kanban" ? <TaskKanbanBoard {...viewProps} /> : <TaskListView {...viewProps} />}

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
