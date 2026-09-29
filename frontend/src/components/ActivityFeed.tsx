"use client";

import type { FormEvent } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { MY_ACTIVITY_QUERY_KEY, useMyActivity } from "@/hooks/useMyActivity";
import { createActivity } from "@/lib/createActivity";
import { ErrorMessage } from "@/components/ErrorMessage";
import { TextField } from "@/components/ui/form/TextField";
import { Spinner } from "@/components/Spinner";

type ActivityFeedProps = {
  organisationId: string;
  maxEntries?: number;
};

export function ActivityFeed({
  organisationId,
  maxEntries,
}: ActivityFeedProps) {
  const queryClient = useQueryClient();
  const activityQuery = useMyActivity(organisationId);

  const createMutation = useMutation({
    mutationFn: (content: string) =>
      createActivity(organisationId, { content }),
    onSuccess: (result) => {
      if (result.ok) {
        queryClient.invalidateQueries({
          queryKey: MY_ACTIVITY_QUERY_KEY(organisationId),
        });
      }
    },
  });

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const content = String(new FormData(form).get("content") ?? "").trim();

    if (!content) {
      return;
    }

    createMutation.mutate(content, {
      onSuccess: (result) => {
        if (result.ok) {
          form.reset();
        }
      },
    });
  }

  const entries = activityQuery.data
    ? maxEntries
      ? activityQuery.data.slice(0, maxEntries)
      : activityQuery.data
    : [];

  return (
    <div className="flex flex-col gap-4">
      <form
        onSubmit={handleSubmit}
        className="flex flex-col gap-2 sm:flex-row sm:items-end"
      >
        <TextField
          label="What are you working on?"
          name="content"
          type="text"
          placeholder="What are you working on?"
          required
          className="flex-1"
        />
        <button
          type="submit"
          disabled={createMutation.isPending}
          className="flex cursor-pointer items-center justify-center gap-2 rounded-md bg-primary px-4 py-2 text-white transition-colors duration-150 hover:bg-primary/90 disabled:cursor-not-allowed disabled:bg-primary/50"
        >
          {createMutation.isPending && <Spinner />}
          {createMutation.isPending ? "Posting…" : "Post"}
        </button>
      </form>

      {activityQuery.isLoading && (
        <p className="flex items-center gap-2 text-slate-900">
          <Spinner className="text-primary-dark" />
          Loading activity…
        </p>
      )}

      {activityQuery.isError && (
        <ErrorMessage
          message={
            activityQuery.error instanceof Error
              ? activityQuery.error.message
              : "Could not load activity."
          }
        />
      )}

      {activityQuery.data && (
        <ul className="flex flex-col gap-2">
          {entries.map((entry) => (
            <li
              key={entry.id}
              className="rounded-md border border-input-border p-3 text-slate-900"
            >
              <p>{entry.content}</p>
              <p className="text-sm text-slate-900/70">
                {new Date(entry.createdAt).toLocaleString()}
              </p>
            </li>
          ))}
          {entries.length === 0 && (
            <li className="text-slate-900">No activity yet.</li>
          )}
        </ul>
      )}
    </div>
  );
}
