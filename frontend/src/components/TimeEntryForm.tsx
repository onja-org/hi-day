"use client";

import type { FormEvent } from "react";
import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useMyProjects } from "@/hooks/useMyProjects";
import { useProjectTasks } from "@/hooks/useProjectTasks";
import { TIME_ENTRIES_QUERY_KEY_PREFIX } from "@/hooks/useTimeEntries";
import { createManualTimeEntry } from "@/lib/createManualTimeEntry";
import { toDatetimeLocalValue } from "@/lib/toDatetimeLocalValue";
import { updateTimeEntry } from "@/lib/updateTimeEntry";
import type { TimeEntryListItem } from "@/types/timeEntry";
import { ErrorMessage } from "./ErrorMessage";
import { Spinner } from "./Spinner";

type TimeEntryFormProps =
  | {
      organisationId: string;
      mode: "create";
      entry?: undefined;
      onSaved: () => void;
    }
  | {
      organisationId: string;
      mode: "edit";
      entry: TimeEntryListItem;
      onSaved: () => void;
    };

export function TimeEntryForm({
  organisationId,
  mode,
  entry,
  onSaved,
}: TimeEntryFormProps) {
  const queryClient = useQueryClient();
  const projectsQuery = useMyProjects(organisationId);
  const [projectId, setProjectId] = useState(entry?.projectId ?? "");
  const tasksQuery = useProjectTasks(organisationId, projectId, {
    enabled: projectId !== "",
  });

  const invalidate = () =>
    queryClient.invalidateQueries({
      queryKey: TIME_ENTRIES_QUERY_KEY_PREFIX(organisationId),
    });

  const createMutation = useMutation({
    mutationFn: (input: {
      projectId: string;
      taskId?: string;
      startedAt: string;
      endedAt: string;
    }) => createManualTimeEntry(organisationId, input),
    onSuccess: (result) => {
      if (result.ok) {
        invalidate();
        onSaved();
      }
    },
  });

  const updateMutation = useMutation({
    mutationFn: (input: {
      projectId?: string;
      taskId?: string | null;
      startedAt?: string;
      endedAt?: string;
    }) => updateTimeEntry(organisationId, entry!.id, input),
    onSuccess: (result) => {
      if (result.ok) {
        invalidate();
        onSaved();
      }
    },
  });

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const taskId = String(formData.get("taskId") ?? "");
    const startedAt = String(formData.get("startedAt") ?? "");
    const endedAt = String(formData.get("endedAt") ?? "");

    if (mode === "create") {
      createMutation.mutate({
        projectId,
        taskId: taskId || undefined,
        startedAt,
        endedAt,
      });
    } else {
      updateMutation.mutate({
        projectId: projectId !== entry.projectId ? projectId : undefined,
        taskId: taskId !== (entry.taskId ?? "") ? taskId || null : undefined,
        startedAt,
        endedAt,
      });
    }
  }

  const mutation = mode === "create" ? createMutation : updateMutation;
  const submitError =
    mutation.data && !mutation.data.ok ? mutation.data.message : null;
  const projects = projectsQuery.data ?? [];
  // Always keep the entry's own (possibly since-closed) task selectable —
  // switching the picker to only open tasks shouldn't silently drop it.
  const tasks = (tasksQuery.data?.tasks ?? []).filter(
    (task) => task.status === "open" || task.id === entry?.taskId,
  );

  return (
    <form onSubmit={handleSubmit} className="flex w-full max-w-lg flex-col gap-5">
      {submitError && <ErrorMessage message={submitError} />}

      <label className="flex flex-col gap-1.5">
        Project
        <select
          value={projectId}
          onChange={(event) => setProjectId(event.target.value)}
          required
          disabled={projectsQuery.isLoading}
          className="rounded-md border border-input-border bg-white px-3 py-2 text-slate-900 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30 disabled:opacity-50"
        >
          <option value="" disabled>
            Select a project…
          </option>
          {projects.map((project) => (
            <option key={project.id} value={project.id}>
              {project.name}
            </option>
          ))}
        </select>
      </label>

      <label className="flex flex-col gap-1.5">
        Task (optional)
        <select
          name="taskId"
          defaultValue={entry?.taskId ?? ""}
          disabled={!projectId}
          className="rounded-md border border-input-border bg-white px-3 py-2 text-slate-900 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30 disabled:opacity-50"
        >
          <option value="">No task</option>
          {tasks.map((task) => (
            <option key={task.id} value={task.id}>
              {task.name}
            </option>
          ))}
        </select>
      </label>

      {/* Always stacked, never side by side: a datetime-local input's native
          width doesn't shrink below its content, so two of them in this
          modal's max-w-lg would overflow it even at sm: widths. */}
      <div className="flex flex-col gap-5">
        <label className="flex flex-1 flex-col gap-1.5">
          Start
          <input
            name="startedAt"
            type="datetime-local"
            required
            defaultValue={entry ? toDatetimeLocalValue(entry.startedAt) : undefined}
            className="w-full rounded-md border border-input-border bg-white px-3 py-2 text-slate-900 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
        </label>

        <label className="flex flex-1 flex-col gap-1.5">
          End
          <input
            name="endedAt"
            type="datetime-local"
            required
            defaultValue={
              entry?.endedAt ? toDatetimeLocalValue(entry.endedAt) : undefined
            }
            className="w-full rounded-md border border-input-border bg-white px-3 py-2 text-slate-900 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
        </label>
      </div>

      <button
        type="submit"
        disabled={mutation.isPending || !projectId}
        className="flex cursor-pointer items-center justify-center gap-2 rounded-md bg-primary px-4 py-2 text-white transition-colors duration-150 hover:bg-primary/90 disabled:cursor-not-allowed disabled:bg-primary/50"
      >
        {mutation.isPending && <Spinner />}
        {mode === "create" ? "Add time" : "Save changes"}
      </button>
    </form>
  );
}
