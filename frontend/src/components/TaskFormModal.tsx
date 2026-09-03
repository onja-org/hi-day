"use client";

import type { Task } from "@/types/task";
import { Modal } from "./Modal";
import { TaskForm } from "./TaskForm";

type TaskFormModalProps = {
  organisationId: string;
  projectId: string;
  task?: Task;
  onClose: () => void;
  onSaved: (task: Task) => void;
};

export function TaskFormModal({
  organisationId,
  projectId,
  task,
  onClose,
  onSaved,
}: TaskFormModalProps) {
  return (
    <Modal title={task ? "Edit task" : "New task"} onClose={onClose}>
      {task ? (
        <TaskForm
          organisationId={organisationId}
          projectId={projectId}
          mode="edit"
          task={task}
          onSaved={onSaved}
        />
      ) : (
        <TaskForm
          organisationId={organisationId}
          projectId={projectId}
          mode="create"
          onSaved={onSaved}
        />
      )}
    </Modal>
  );
}
