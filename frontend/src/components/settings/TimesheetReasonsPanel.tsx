"use client";

import { useState } from "react";
import type { FormEvent } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useCurrentOrganisation } from "@/hooks/useCurrentOrganisation";
import {
  TIMESHEET_REASONS_QUERY_KEY,
  useTimesheetReasons,
} from "@/hooks/useTimesheetReasons";
import { createTimesheetReason } from "@/lib/createTimesheetReason";
import { deleteTimesheetReason } from "@/lib/deleteTimesheetReason";
import { renameTimesheetReason } from "@/lib/renameTimesheetReason";
import { ErrorMessage } from "@/components/ErrorMessage";
import { Spinner } from "@/components/Spinner";
import { TimesheetReasonRow } from "./TimesheetReasonRow";

/** Mirrors the backend's MAX_TIMESHEET_REASONS, so the form stops offering
 * an add that the server would refuse. */
const MAX_REASONS = 50;

export function TimesheetReasonsPanel() {
  const organisationQuery = useCurrentOrganisation();
  const organisation = organisationQuery.data;
  const organisationId = organisation ? String(organisation.id) : "";
  const reasonsQuery = useTimesheetReasons(organisationId);
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);

  function refresh() {
    queryClient.invalidateQueries({
      queryKey: TIMESHEET_REASONS_QUERY_KEY(organisationId),
    });
  }

  const createMutation = useMutation({
    mutationFn: (label: string) => createTimesheetReason(organisationId, label),
    onSuccess: (result) => {
      if (!result.ok) {
        setError(result.message);
        return;
      }
      setDraft("");
      refresh();
    },
  });

  const renameMutation = useMutation({
    mutationFn: ({ id, label }: { id: string; label: string }) =>
      renameTimesheetReason(organisationId, id, label),
    onSuccess: (result) => {
      if (!result.ok) {
        setError(result.message);
        return;
      }
      refresh();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteTimesheetReason(organisationId, id),
    onSuccess: (result) => {
      if (!result.ok) {
        setError(result.message);
        return;
      }
      refresh();
    },
  });

  function handleAdd(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    const label = draft.trim();
    if (label === "") return;
    createMutation.mutate(label);
  }

  if (organisationQuery.isLoading || reasonsQuery.isLoading) {
    return (
      <p className="flex items-center gap-2 py-8 text-slate-900">
        <Spinner className="text-primary-dark" />
        Loading…
      </p>
    );
  }

  if (!organisation || reasonsQuery.isError) {
    return (
      <ErrorMessage
        message={
          reasonsQuery.error instanceof Error
            ? reasonsQuery.error.message
            : "Could not load these settings."
        }
      />
    );
  }

  const reasons = reasonsQuery.data ?? [];
  const isFull = reasons.length >= MAX_REASONS;

  return (
    <section className="flex flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h3 className="text-xs font-semibold tracking-wider text-slate-900/60 uppercase">
          Reasons
        </h3>
        <p className="text-sm text-slate-900">
          What people can pick from when they add, edit or delete time. The
          wording is copied onto the record at the moment it&apos;s picked, so
          renaming or removing a reason never rewrites past entries.
        </p>
      </header>

      {error && <ErrorMessage message={error} />}

      <form onSubmit={handleAdd} className="flex flex-wrap items-end gap-3">
        <label className="flex min-w-0 flex-1 flex-col gap-1.5">
          <span className="text-sm font-medium text-slate-900">New reason</span>
          <input
            type="text"
            value={draft}
            maxLength={100}
            disabled={isFull}
            onChange={(event) => setDraft(event.target.value)}
            placeholder="e.g. Forgot to start timer"
            className="w-full rounded-brand-sm border-2 border-ink bg-white px-3 py-2 text-slate-900 focus:border-primary focus:ring-2 focus:ring-primary/30 focus:outline-none disabled:opacity-50"
          />
        </label>
        <button
          type="submit"
          disabled={draft.trim() === "" || isFull || createMutation.isPending}
          className="flex h-11 cursor-pointer items-center justify-center gap-2 rounded-brand-sm border-2 border-ink bg-primary px-4 font-bold text-white transition-colors duration-150 hover:bg-primary/90 disabled:cursor-not-allowed disabled:bg-primary/50"
        >
          {createMutation.isPending && <Spinner />}
          Add reason
        </button>
      </form>

      {isFull && (
        <p className="text-sm text-slate-900/60">
          This list is full at {MAX_REASONS} reasons — remove one to add
          another.
        </p>
      )}

      <ul className="flex flex-col divide-y-2 divide-input-border rounded-brand-sm border-2 border-ink bg-white">
        {reasons.length === 0 && (
          <li className="px-4 py-6 text-sm text-slate-900/60">
            No reasons yet. Add one above.
          </li>
        )}
        {reasons.map((reason) => (
          <TimesheetReasonRow
            key={reason.id}
            reason={reason}
            onRename={(label) =>
              renameMutation.mutate({ id: reason.id, label })
            }
            onDelete={() => deleteMutation.mutate(reason.id)}
            isBusy={
              (renameMutation.isPending &&
                renameMutation.variables?.id === reason.id) ||
              (deleteMutation.isPending &&
                deleteMutation.variables === reason.id)
            }
          />
        ))}
      </ul>
    </section>
  );
}
