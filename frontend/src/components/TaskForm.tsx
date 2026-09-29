"use client";

import type { FormEvent } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { PROJECT_TASKS_QUERY_KEY } from "@/hooks/useProjectTasks";
import { useProject } from "@/hooks/useProject";
import { createTask } from "@/lib/createTask";
import { updateTask } from "@/lib/updateTask";
import type { Task, TaskFormInput, UpdateTaskInput } from "@/types/task";
import { Spinner } from "./Spinner";

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
    <form onSubmit={handleSubmit} className="flex w-full max-w-lg flex-col gap-5">
      <label className="flex flex-col gap-1.5">
        Name
        <input
          name="name"
          type="text"
          required
          maxLength={255}
          defaultValue={task?.name}
          className="rounded-md border border-input-border bg-white px-3 py-2 text-slate-900 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
        />
      </label>

      <label className="flex flex-col gap-1.5">
        Description (optional)
        <textarea
          name="description"
          rows={3}
          maxLength={2000}
          defaultValue={task?.description ?? ""}
          className="rounded-md border border-input-border bg-white px-3 py-2 text-slate-900 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
        />
      </label>

      <label className="flex flex-col gap-1.5">
        Assignee (optional)
        <select
          name="assigneeProjectMembershipId"
          defaultValue={task?.assignee?.membershipId ?? ""}
          disabled={projectQuery.isLoading}
          className="rounded-md border border-input-border bg-white px-3 py-2 text-slate-900 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30 disabled:opacity-50"
        >
          <option value="">Unassigned</option>
          {members.map((member) => (
            <option key={member.id} value={member.id}>
              {member.name ?? member.email}
            </option>
          ))}
        </select>
      </label>

      <div className="flex flex-col gap-5 sm:flex-row">
        <label className="flex flex-1 flex-col gap-1.5">
          Estimate in hours (optional)
          <input
            name="estimate"
            type="number"
            min="0"
            step="0.25"
            defaultValue={task?.estimate ?? ""}
            placeholder="0.00"
            className="rounded-md border border-input-border bg-white px-3 py-2 text-slate-900 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
        </label>

        <label className="flex flex-1 flex-col gap-1.5">
          Due date (optional)
          <input
            name="dueDate"
            type="date"
            defaultValue={task?.dueDate ?? ""}
            className="rounded-md border border-input-border bg-white px-3 py-2 text-slate-900 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
        </label>
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
