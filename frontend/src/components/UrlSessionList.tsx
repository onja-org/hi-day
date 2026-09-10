"use client";

import { Trash } from "@phosphor-icons/react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { deleteUrlSession } from "@/lib/deleteUrlSession";
import { formatElapsed } from "@/lib/formatElapsed";
import { URL_SESSIONS_QUERY_KEY, useUrlSessions } from "@/hooks/useUrlSessions";
import { ErrorMessage } from "./ErrorMessage";
import { Spinner } from "./Spinner";

type UrlSessionListProps = {
  organisationId: string;
  /** Omit to show the caller's own tracked URLs. */
  membershipId?: string;
  /** Only meaningful together with `membershipId` — admin/manager viewing a specific member. */
  showDelete?: boolean;
  /** Caps how many rows render (most recently visited first) — the dashboard's compact preview. */
  maxEntries?: number;
};

export function UrlSessionList({
  organisationId,
  membershipId,
  showDelete = false,
  maxEntries,
}: UrlSessionListProps) {
  const queryClient = useQueryClient();
  const urlSessionsQuery = useUrlSessions(organisationId, membershipId);

  const deleteMutation = useMutation({
    mutationFn: (url: string) =>
      deleteUrlSession(organisationId, membershipId!, url),
    onSuccess: (result) => {
      if (result.ok) {
        void queryClient.invalidateQueries({
          queryKey: URL_SESSIONS_QUERY_KEY(organisationId, membershipId),
        });
      }
    },
  });

  if (urlSessionsQuery.isLoading) {
    return (
      <p className="flex items-center gap-2 text-slate-900">
        <Spinner className="text-primary-dark" />
        Loading activity…
      </p>
    );
  }

  if (urlSessionsQuery.isError || !urlSessionsQuery.data) {
    return (
      <ErrorMessage
        message={
          urlSessionsQuery.error instanceof Error
            ? urlSessionsQuery.error.message
            : "Could not load website activity."
        }
      />
    );
  }

  const groups = maxEntries
    ? urlSessionsQuery.data.slice(0, maxEntries)
    : urlSessionsQuery.data;

  if (groups.length === 0) {
    return <p className="text-slate-900">No website activity yet.</p>;
  }

  return (
    <ul className="flex flex-col gap-2">
      {groups.map((group) => (
        <li
          key={group.url}
          className="flex items-center justify-between gap-3 rounded-md border border-input-border p-3 text-slate-900"
        >
          <div className="flex min-w-0 flex-col gap-0.5">
            <a
              href={group.url}
              target="_blank"
              rel="noopener noreferrer"
              className="truncate text-primary underline-offset-2 hover:underline"
            >
              {group.url}
            </a>
            {group.title && (
              <span className="truncate text-sm text-slate-900/70">{group.title}</span>
            )}
            <span className="text-sm text-slate-900/70">
              Focused {formatElapsed(group.totalActiveMs)} · last visited{" "}
              {new Date(group.lastVisitedAt).toLocaleString()}
            </span>
          </div>
          {showDelete && membershipId && (
            <button
              type="button"
              onClick={() => deleteMutation.mutate(group.url)}
              disabled={deleteMutation.isPending}
              aria-label={`Delete tracked activity for ${group.url}`}
              className="flex shrink-0 cursor-pointer items-center gap-1.5 rounded-md border border-input-border px-3 py-1.5 text-sm text-slate-900 transition-colors duration-150 hover:bg-cream disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Trash size={16} aria-hidden="true" />
              Delete
            </button>
          )}
        </li>
      ))}
    </ul>
  );
}
