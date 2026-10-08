"use client";

import { useState } from "react";
import { useProjectTasks } from "@/hooks/useProjectTasks";
import type { Task } from "@/types/task";
import { ErrorMessage } from "./ErrorMessage";
import { Spinner } from "./Spinner";
import { TaskDetailModal } from "./TaskDetailModal";
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
  const [creating, setCreating] = useState(false);
  const [openTask, setOpenTask] = useState<Task | null>(null);

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
    onOpenTask: (task: Task) => setOpenTask(task),
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex min-h-9 items-center justify-between gap-4">
        <p className="text-sm text-slate-900/70">
          {canManage
            ? "Drag a card to change its status, or open it to edit."
            : "You can move the tasks assigned to you. Open a task to see its details."}
        </p>
        {canManage && !isArchived && (
          <button
            type="button"
            onClick={() => setCreating(true)}
            className="shrink-0 cursor-pointer rounded-brand-sm bg-primary px-5 h-11 text-sm font-bold text-white transition-colors duration-150 hover:bg-primary/90 border-2 border-ink"
          >
            Add task
          </button>
        )}
      </div>

      {view === "kanban" ? <TaskKanbanBoard {...viewProps} /> : <TaskListView {...viewProps} />}

      {creating && (
        <TaskFormModal
          organisationId={organisationId}
          projectId={projectId}
          onClose={() => setCreating(false)}
          onSaved={() => setCreating(false)}
        />
      )}
      {openTask && (
        <TaskDetailModal
          organisationId={organisationId}
          task={openTask}
          canManage={canManage && !isArchived}
          canMove={!isArchived && (canManage || openTask.assignedToMe)}
          onClose={() => setOpenTask(null)}
        />
      )}
    </div>
  );
}
