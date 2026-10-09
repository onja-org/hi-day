"use client";

import type { FormEvent } from "react";
import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useMyProjects } from "@/hooks/useMyProjects";
import { useProject } from "@/hooks/useProject";
import { useProjectTasks } from "@/hooks/useProjectTasks";
import { useInvalidateTimeEntryViews } from "@/hooks/useInvalidateTimeEntryViews";
import { useRequireTimeEntryReason } from "@/hooks/useRequireTimeEntryReason";
import { createManualTimeEntry } from "@/lib/createManualTimeEntry";
import { describeTimeEntryChanges } from "@/lib/describeTimeEntryChanges";
import { findOverlappingEntry } from "@/lib/findOverlappingEntry";
import { formatClockTime } from "@/lib/formatClockTime";
import type { TimeEntryChange } from "@/lib/describeTimeEntryChanges";
import {
  hasNoErrors,
  serverMessageToField,
  validateTimeRange,
  type TimeEntryFieldErrors,
} from "@/lib/timeEntryFieldErrors";
import { updateTimeEntry } from "@/lib/updateTimeEntry";
import type { TimeEntryListItem, UpdateTimeEntryInput } from "@/types/timeEntry";
import { LogTimeForSelect } from "@/components/LogTimeForSelect";
import { Spinner } from "@/components/Spinner";
import { TimeEntryReasonField } from "@/components/TimeEntryReasonField";
import { TimeEntryEditConfirmDialog } from "@/components/TimeEntryEditConfirmDialog";
import { TimeEntryTimeFields } from "@/components/TimeEntryTimeFields";
import { ErrorMessage } from "@/components/ErrorMessage";
import { SelectField } from "@/components/ui/form/SelectField";

type TimeEntryFormProps =
  | {
      organisationId: string;
      mode: "create";
      entry?: undefined;
      /** Whose timesheet the entry lands on. Set when an admin is adding
       * time to someone else's day; omitted, it's the caller's own. */
      forMembershipId?: string;
      /** Entries already on screen, for warning about a clash early. */
      existingEntries?: TimeEntryListItem[];
      onSaved: () => void;
    }
  | {
      organisationId: string;
      mode: "edit";
      entry: TimeEntryListItem;
      forMembershipId?: undefined;
      existingEntries?: TimeEntryListItem[];
      onSaved: () => void;
    };

export function TimeEntryForm({
  organisationId,
  mode,
  entry,
  forMembershipId,
  existingEntries,
  onSaved,
}: TimeEntryFormProps) {
  const projectsQuery = useMyProjects(organisationId);
  const [projectId, setProjectId] = useState(entry?.projectId ?? "");
  const [errors, setErrors] = useState<TimeEntryFieldErrors>({});
  // Held here rather than read off FormData: the field is a picker with an
  // "Other…" free-text fallback, so it needs controlled state.
  const [reason, setReason] = useState("");
  const isReasonRequired = useRequireTimeEntryReason();
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
      reason?: string;
    }) => createManualTimeEntry(organisationId, input),
    // Shown under the field at fault rather than as a toast in the corner
    meta: { inlineErrors: true },
    onSuccess: (result) => {
      if (result.ok) {
        invalidate();
        onSaved();
        return;
      }
      setErrors(serverMessageToField(result.message));
    },
  });

  const updateMutation = useMutation({
    mutationFn: (input: {
      projectId?: string;
      taskId?: string | null;
      startedAt?: string;
      endedAt?: string;
      reason?: string;
    }) => updateTimeEntry(organisationId, entry!.id, input),
    meta: { inlineErrors: true },
    onSuccess: (result) => {
      if (result.ok) {
        invalidate();
        onSaved();
        return;
      }
      setPendingEdit(null);
      setErrors(serverMessageToField(result.message));
    },
  });

  /** Judges the times as they are picked, rather than on submit. Silent
   * while either is empty — someone part-way through has not erred yet. */
  function handleTimesChange(startedAt: string, endedAt: string): void {
    if (startedAt === "" || endedAt === "") {
      setErrors({});
      return;
    }

    const rangeErrors = validateTimeRange(startedAt, endedAt);
    if (!hasNoErrors(rangeErrors)) {
      setErrors(rangeErrors);
      return;
    }

    // Only when we know whose day it is, or an admin's view of someone
    // else's entry would read as a clash.
    const membershipId = entry?.membershipId ?? forMembershipId;
    const clash =
      existingEntries && membershipId
        ? findOverlappingEntry({
            entries: existingEntries,
            membershipId,
            excludeId: entry?.id,
            startedAt,
            endedAt,
          })
        : null;

    setErrors(
      clash
        ? {
            range: `Overlaps ${clash.projectName}, already tracked ${formatClockTime(clash.startedAt)}–${clash.endedAt ? formatClockTime(clash.endedAt) : "now"}.`,
          }
        : {},
    );
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const taskId = String(formData.get("taskId") ?? "");
    const startedAt = String(formData.get("startedAt") ?? "");
    const endedAt = String(formData.get("endedAt") ?? "");
    const membershipId = String(formData.get("membershipId") ?? "");
    const trimmedReason = reason.trim();

    if (isReasonRequired && trimmedReason === "") {
      setErrors({ form: "Give a reason for this change." });
      return;
    }

    if (!isTicking) {
      const rangeErrors = validateTimeRange(startedAt, endedAt);
      if (!hasNoErrors(rangeErrors)) {
        setErrors(rangeErrors);
        return;
      }
    }
    setErrors({});

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
        reason: trimmedReason || undefined,
      });
    } else {
      const input: UpdateTimeEntryInput = {
        projectId: projectId !== entry.projectId ? projectId : undefined,
        taskId: taskId !== (entry.taskId ?? "") ? taskId || null : undefined,
        startedAt,
        endedAt: isTicking ? undefined : endedAt,
        reason: trimmedReason || undefined,
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
        <SelectField
          label="Project"
          value={projectId}
          onChange={(event) => setProjectId(event.target.value)}
          required
          disabled={projectsQuery.isLoading}
        >
          <option value="" disabled>
            Select a project…
          </option>
          {projects.map((project) => (
            <option key={project.id} value={project.id}>
              {project.name}
            </option>
          ))}
        </SelectField>

        <SelectField
          label="Task (optional)"
          name="taskId"
          defaultValue={entry?.taskId ?? ""}
          disabled={!projectId}
        >
          <option value="">No task</option>
          {tasks.map((task) => (
            <option key={task.id} value={task.id}>
              {task.name}
            </option>
          ))}
        </SelectField>

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
          errors={errors}
          onChange={handleTimesChange}
        />

        {/* Both modes: an added entry is a manual time change like any
            other, and the Manual time edits report has a column for it. */}
        <TimeEntryReasonField
          organisationId={organisationId}
          value={reason}
          onChange={setReason}
        />

        {errors.form && <ErrorMessage message={errors.form} />}

        <button
          type="submit"
          disabled={mutation.isPending || !projectId}
          className="flex cursor-pointer items-center justify-center gap-2 rounded-brand-sm bg-primary px-4 h-11 text-white transition-colors duration-150 hover:bg-primary/90 disabled:cursor-not-allowed disabled:bg-primary/50 border-2 border-ink font-bold"
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
