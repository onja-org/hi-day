"use client";

import { useMemberActivity } from "@/hooks/useMemberActivity";
import { ErrorMessage } from "./ErrorMessage";
import { Spinner } from "./Spinner";

type MemberActivityListProps = {
  organisationId: string;
  membershipId: string;
};

export function MemberActivityList({
  organisationId,
  membershipId,
}: MemberActivityListProps) {
  const activityQuery = useMemberActivity(organisationId, membershipId, true);

  if (activityQuery.isLoading) {
    return (
      <p className="flex items-center gap-2 text-slate-900">
        <Spinner className="text-primary-dark" />
        Loading activity…
      </p>
    );
  }

  if (activityQuery.isError || !activityQuery.data) {
    return (
      <ErrorMessage
        message={
          activityQuery.error instanceof Error
            ? activityQuery.error.message
            : "Could not load activity."
        }
      />
    );
  }

  if (activityQuery.data.length === 0) {
    return <p className="text-slate-900">No activity yet.</p>;
  }

  return (
    <ul className="flex flex-col gap-2">
      {activityQuery.data.map((entry) => (
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
    </ul>
  );
}
