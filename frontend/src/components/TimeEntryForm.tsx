"use client";

import type { FormEvent } from "react";
import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useMyProjects } from "@/hooks/useMyProjects";
import { useProject } from "@/hooks/useProject";
import { useProjectTasks } from "@/hooks/useProjectTasks";
import { useInvalidateTimeEntryViews } from "@/hooks/useInvalidateTimeEntryViews";
import { createManualTimeEntry } from "@/lib/createManualTimeEntry";
import { describeTimeEntryChanges } from "@/lib/describeTimeEntryChanges";
import type { TimeEntryChange } from "@/lib/describeTimeEntryChanges";
import { updateTimeEntry } from "@/lib/updateTimeEntry";
import type { TimeEntryListItem, UpdateTimeEntryInput } from "@/types/timeEntry";
import { LogTimeForSelect } from "./LogTimeForSelect";
import { Spinner } from "./Spinner";
import { TimeEntryTimeFields } from "./TimeEntryTimeFields";
import { TimeEntryEditConfirmDialog } from "./TimeEntryEditConfirmDialog";

type TimeEntryFormProps =
  | {
      organisationId: string;
      mode: "create";
      entry?: undefined;
      /** Whose timesheet the entry lands on. Set when an admin is adding
       * time to someone else's day; omitted, it's the caller's own. */
      forMembershipId?: string;
      onSaved: () => void;
    }
  | {
      organisationId: string;
      mode: "edit";
      entry: TimeEntryListItem;
      forMembershipId?: undefined;
      onSaved: () => void;
    };

export function TimeEntryForm({
  organisationId,
  mode,
  entry,
  forMembershipId,
  onSaved,
}: TimeEntryFormProps) {
  const projectsQuery = useMyProjects(organisationId);
  const [projectId, setProjectId] = useState(entry?.projectId ?? "");
  // An edit is held here between submitting the form and confirming it, so
  // the confirmation shows the real diff and applies exactly what was
  // shown. Null means nothing is awaiting confirmation.
  const [pendingEdit, setPendingEdit] = useState<{
    input: UpdateTimeEntryInput;
    changes: TimeEntryChange[];
  } | null>(null);
  const tasksQuery = useProjectTasks(organisationId, projectId, {
    enabled: projectId !== "",
  });

  const projects = projectsQuery.data ?? [];
  const selectedProject = projects.find((project) => project.id === projectId);
  // Only offered when creating a new entry — re-attributing an existing
  // one to someone else isn't part of this form.
  const canLogTimeForOthers =
    mode === "create" &&
    forMembershipId === undefined &&
    (selectedProject?.canLogTimeForOthers ?? false);
  const projectDetailQuery = useProject(organisationId, projectId, {
    enabled: canLogTimeForOthers,
  });

  const invalidate = useInvalidateTimeEntryViews(organisationId);

  const createMutation = useMutation({
    mutationFn: (input: {
      projectId: string;
      taskId?: string;
      startedAt: string;
      endedAt: string;
      membershipId?: string;
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
    const membershipId = String(formData.get("membershipId") ?? "");

    if (mode === "create") {
      createMutation.mutate({
        projectId,
        taskId: taskId || undefined,
        startedAt,
        endedAt,
        // `membershipId` is read off FormData, so it's "" (not undefined)
        // when the picker is absent or left on "Me" — `||`, not `??`, since
        // an empty string has to fall through to undefined rather than be
        // sent and fail the backend's UUID validation.
        membershipId: forMembershipId ?? (membershipId || undefined),
      });
    } else {
      const input: UpdateTimeEntryInput = {
        projectId: projectId !== entry.projectId ? projectId : undefined,
        taskId: taskId !== (entry.taskId ?? "") ? taskId || null : undefined,
        startedAt,
        endedAt: isTicking ? undefined : endedAt,
      };
      const changes = describeTimeEntryChanges(
        {
          projectName: entry.projectName,
          taskName: entry.taskName,
          startedAt: entry.startedAt,
          endedAt: entry.endedAt ?? "",
        },
        {
          projectName: selectedProject?.name ?? entry.projectName,
          taskName: tasks.find((task) => task.id === taskId)?.name ?? null,
          startedAt,
          endedAt: isTicking ? "" : endedAt,
        },
      );
      // Nothing to confirm when nothing moved — the backend treats such an
      // edit as a no-op too, writing no audit row for it.
      if (changes.length === 0) {
        updateMutation.mutate(input);
        return;
      }
      setPendingEdit({ input, changes });
    }
  }

  const mutation = mode === "create" ? createMutation : updateMutation;
  // Always keep the entry's own (possibly since-closed) task selectable —
  // switching the picker to only open tasks shouldn't silently drop it.
  const startedAtDefault = entry?.startedAt;
  // A paused entry has `endedAt` null just like a ticking one, so both land
  // here with no end to edit. The field is withheld rather than shown empty
  // — the backend refuses an end time on an entry that hasn't stopped, and
  // a required-but-unfillable input would just wedge the form.
  // Ticking, as opposed to paused: a paused entry has no end *yet*, but can
  // be given one, which closes it where it left off.
  const isTicking =
    mode === "edit" && entry.endedAt === null && entry.pausedAt === null;
  // Where a paused entry's end defaults to — the moment it stopped
  // accruing, which is almost always the end someone means.
  const endedAtDefault = entry?.endedAt ?? entry?.pausedAt ?? undefined;
  const tasks = (tasksQuery.data?.tasks ?? []).filter(
    (task) => task.status === "open" || task.id === entry?.taskId,
  );

  return (
    <>
      <form onSubmit={handleSubmit} className="flex w-full max-w-lg flex-col gap-5">
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

        {canLogTimeForOthers && (
          // Keyed on projectId: without a fresh mount per project, switching
          // from one project to another would leave a stale membershipId
          // selected in the DOM (an uncontrolled <select>) even though the
          // option list re-rendered — a confusing 403 on submit instead of
          // resetting to "Me".
          <LogTimeForSelect
            key={projectId}
            // A viewer can't have time logged on this project.
            members={(projectDetailQuery.data?.members ?? []).filter(
              (member) => member.role !== "viewer",
            )}
          />
        )}

        <TimeEntryTimeFields
          startedAt={startedAtDefault}
          endedAt={endedAtDefault}
          isTicking={isTicking}
        />

        <button
          type="submit"
          disabled={mutation.isPending || !projectId}
          className="flex cursor-pointer items-center justify-center gap-2 rounded-md bg-primary px-4 py-2 text-white transition-colors duration-150 hover:bg-primary/90 disabled:cursor-not-allowed disabled:bg-primary/50"
        >
          {mutation.isPending && <Spinner />}
          {mode === "create" ? "Add time" : "Save changes"}
        </button>
      </form>

      {pendingEdit && (
        <TimeEntryEditConfirmDialog
          changes={pendingEdit.changes}
          isPending={updateMutation.isPending}
          onConfirm={() => updateMutation.mutate(pendingEdit.input)}
          onClose={() => setPendingEdit(null)}
        />
      )}
    </>
  );
}
