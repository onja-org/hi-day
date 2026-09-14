"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { deleteUrlSession } from "@/lib/deleteUrlSession";
import { groupUrlSessionsByDomain } from "@/lib/groupUrlSessionsByDomain";
import { URL_SESSIONS_QUERY_KEY, useUrlSessions } from "@/hooks/useUrlSessions";
import { ErrorMessage } from "./ErrorMessage";
import { Spinner } from "./Spinner";
import { UrlSessionDomainAccordion } from "./UrlSessionDomainAccordion";

type UrlSessionListProps = {
  organisationId: string;
  /** Omit to show the caller's own tracked URLs. */
  membershipId?: string;
  /** Only meaningful together with `membershipId` — admin/manager viewing a specific member. */
  showDelete?: boolean;
  /** Caps how many DOMAINS render (most recently visited first) — the dashboard's compact preview. */
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

  const domains = groupUrlSessionsByDomain(urlSessionsQuery.data);
  const visible = maxEntries ? domains.slice(0, maxEntries) : domains;

  if (visible.length === 0) {
    return <p className="text-slate-900">No website activity yet.</p>;
  }

  return (
    <div className="flex flex-col gap-2">
      {visible.map((group) => (
        <UrlSessionDomainAccordion
          key={group.domain}
          group={group}
          onDelete={
            showDelete && membershipId
              ? (url) => deleteMutation.mutate(url)
              : undefined
          }
          isDeleting={deleteMutation.isPending}
        />
      ))}
    </div>
  );
}
