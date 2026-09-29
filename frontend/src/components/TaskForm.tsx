"use client";

import type { FormEvent } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { PROJECT_TASKS_QUERY_KEY } from "@/hooks/useProjectTasks";
import { useProject } from "@/hooks/useProject";
import { createTask } from "@/lib/createTask";
import { updateTask } from "@/lib/updateTask";
import type { Task, TaskFormInput, UpdateTaskInput } from "@/types/task";
import { SelectField } from "@/components/ui/form/SelectField";
import { TextareaField } from "@/components/ui/form/TextareaField";
import { TextField } from "@/components/ui/form/TextField";
import { Spinner } from "@/components/Spinner";

type TaskFormProps =
  | {
      organisationId: string;
      projectId: string;
      mode: "create";
      task?: undefined;
      onSaved: (task: Task) => void;
    }
  | {
      organisationId: string;
      projectId: string;
      mode: "edit";
      task: Task;
      onSaved: (task: Task) => void;
    };

export function TaskForm({
  organisationId,
  projectId,
  mode,
  task,
  onSaved,
}: TaskFormProps) {
  const queryClient = useQueryClient();
  const projectQuery = useProject(organisationId, projectId);

  const mutation = useMutation({
    mutationFn: (input: TaskFormInput | UpdateTaskInput) =>
      mode === "create"
        ? createTask(organisationId, projectId, input as TaskFormInput)
        : updateTask(organisationId, projectId, task.id, input),
    onSuccess: (result) => {
      if (result.ok) {
        queryClient.invalidateQueries({
          queryKey: PROJECT_TASKS_QUERY_KEY(organisationId, projectId),
        });
        onSaved(result.task);
      }
    },
  });

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const name = String(formData.get("name") ?? "").trim();
    if (!name) {
      return;
    }

    const description = String(formData.get("description") ?? "").trim();
    const estimate = String(formData.get("estimate") ?? "").trim();
    const dueDate = String(formData.get("dueDate") ?? "").trim();
    const assignee = String(formData.get("assigneeProjectMembershipId") ?? "");

    if (mode === "create") {
      mutation.mutate({
        name,
        description: description || undefined,
        estimate: estimate || undefined,
        dueDate: dueDate || undefined,
        assigneeProjectMembershipId: assignee || undefined,
      } satisfies TaskFormInput);
    } else {
      mutation.mutate({
        name,
        description: description || undefined,
        estimate: estimate || undefined,
        dueDate: dueDate || undefined,
        assigneeProjectMembershipId: assignee || null,
      } satisfies UpdateTaskInput);
    }
  }

  // A viewer can't be assigned tasks (the backend rejects it).
  const members = (projectQuery.data?.members ?? []).filter((member) => member.role !== "viewer");

  return (
    <form
      onSubmit={handleSubmit}
      className="flex w-full max-w-lg flex-col gap-5"
    >
      <TextField
        label="Name"
        name="name"
        type="text"
        required
        maxLength={255}
        defaultValue={task?.name}
      />

      <TextareaField
        label="Description (optional)"
        name="description"
        rows={3}
        maxLength={2000}
        defaultValue={task?.description ?? ""}
      />

      <SelectField
        label="Assignee (optional)"
        name="assigneeProjectMembershipId"
        defaultValue={task?.assignee?.membershipId ?? ""}
        disabled={projectQuery.isLoading}
      >
        <option value="">Unassigned</option>
        {members.map((member) => (
          <option key={member.id} value={member.id}>
            {member.name ?? member.email}
          </option>
        ))}
      </SelectField>

      <div className="flex flex-col gap-5 sm:flex-row">
        <TextField
          label="Estimate in hours (optional)"
          className="flex-1"
          name="estimate"
          type="number"
          min="0"
          step="0.25"
          defaultValue={task?.estimate ?? ""}
          placeholder="0.00"
        />

        <TextField
          label="Due date (optional)"
          className="flex-1"
          name="dueDate"
          type="date"
          defaultValue={task?.dueDate ?? ""}
        />
      </div>

      <button
        type="submit"
        disabled={mutation.isPending}
        className="flex cursor-pointer items-center justify-center gap-2 rounded-md bg-primary px-4 py-2 text-white transition-colors duration-150 hover:bg-primary/90 disabled:cursor-not-allowed disabled:bg-primary/50"
      >
        {mutation.isPending && <Spinner />}
        {mode === "create" ? "Create task" : "Save changes"}
      </button>
    </form>
  );
}
