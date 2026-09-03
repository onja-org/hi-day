"use client";

import type { FormEvent } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  MY_TIME_ENTRIES_QUERY_KEY,
  useMyTimeEntries,
} from "@/hooks/useMyTimeEntries";
import { createTimeEntry } from "@/lib/createTimeEntry";
import { formatDuration } from "@/lib/formatDuration";
import { ErrorMessage } from "./ErrorMessage";
import { Spinner } from "./Spinner";

type TimesheetFeedProps = {
  organisationId: string;
  maxEntries?: number;
};

export function TimesheetFeed({
  organisationId,
  maxEntries,
}: TimesheetFeedProps) {
  const queryClient = useQueryClient();
  const entriesQuery = useMyTimeEntries(organisationId);

  const createMutation = useMutation({
    mutationFn: (input: {
      startedAt: string;
      endedAt: string;
      note: string;
    }) =>
      createTimeEntry(organisationId, {
        startedAt: new Date(input.startedAt).toISOString(),
        endedAt: new Date(input.endedAt).toISOString(),
        note: input.note || undefined,
      }),
    onSuccess: (result) => {
      if (result.ok) {
        queryClient.invalidateQueries({
          queryKey: MY_TIME_ENTRIES_QUERY_KEY(organisationId),
        });
      }
    },
  });

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    const startedAt = String(formData.get("startedAt") ?? "");
    const endedAt = String(formData.get("endedAt") ?? "");
    const note = String(formData.get("note") ?? "").trim();

    if (!startedAt || !endedAt) {
      return;
    }

    createMutation.mutate(
      { startedAt, endedAt, note },
      {
        onSuccess: (result) => {
          if (result.ok) {
            form.reset();
          }
        },
      },
    );
  }

  const entries = entriesQuery.data
    ? maxEntries
      ? entriesQuery.data.slice(0, maxEntries)
      : entriesQuery.data
    : [];

  return (
    <div className="flex flex-col gap-4">
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <div className="flex flex-col gap-3 sm:flex-row">
          <label className="flex flex-1 flex-col gap-1.5 text-slate-900">
            Start
            <input
              name="startedAt"
              type="datetime-local"
              required
              className="rounded-md border border-input-border bg-white px-3 py-2 text-slate-900 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </label>
          <label className="flex flex-1 flex-col gap-1.5 text-slate-900">
            End
            <input
              name="endedAt"
              type="datetime-local"
              required
              className="rounded-md border border-input-border bg-white px-3 py-2 text-slate-900 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </label>
        </div>

        <label className="flex flex-col gap-1.5 text-slate-900">
          Note (optional)
          <input
            name="note"
            type="text"
            placeholder="What did you work on?"
            className="rounded-md border border-input-border bg-white px-3 py-2 text-slate-900 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
        </label>

        <button
          type="submit"
          disabled={createMutation.isPending}
          className="flex cursor-pointer items-center justify-center gap-2 self-start rounded-md bg-primary px-4 py-2 text-white transition-colors duration-150 hover:bg-primary/90 disabled:cursor-not-allowed disabled:bg-primary/50"
        >
          {createMutation.isPending && <Spinner />}
          {createMutation.isPending ? "Logging…" : "Log time"}
        </button>
      </form>

      {createMutation.data && !createMutation.data.ok && (
        <ErrorMessage message={createMutation.data.message} />
      )}

      {entriesQuery.isLoading && (
        <p className="flex items-center gap-2 text-slate-900">
          <Spinner className="text-primary-dark" />
          Loading timesheet…
        </p>
      )}

      {entriesQuery.isError && (
        <ErrorMessage
          message={
            entriesQuery.error instanceof Error
              ? entriesQuery.error.message
              : "Could not load your timesheet."
          }
        />
      )}

      {entriesQuery.data && (
        <ul className="flex flex-col gap-2">
          {entries.map((entry) => (
            <li
              key={entry.id}
              className="rounded-md border border-input-border p-3 text-slate-900"
            >
              <p className="font-medium">
                {formatDuration(entry.durationMinutes)}
              </p>
              <p className="text-sm text-slate-900/70">
                {new Date(entry.startedAt).toLocaleString()} –{" "}
                {new Date(entry.endedAt).toLocaleString()}
              </p>
              {entry.note && <p>{entry.note}</p>}
            </li>
          ))}
          {entries.length === 0 && (
            <li className="text-slate-900">
              You haven&apos;t logged any hours yet.
            </li>
          )}
        </ul>
      )}
    </div>
  );
}
