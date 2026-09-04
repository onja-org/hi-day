"use client";

import { useMemberTimeEntries } from "@/hooks/useMemberTimeEntries";
import { formatDuration } from "@/lib/formatDuration";
import { ErrorMessage } from "./ErrorMessage";
import { ProjectColourBadge } from "./ProjectColourBadge";
import { Spinner } from "./Spinner";

type MemberTimeEntriesListProps = {
  organisationId: string;
  membershipId: string;
};

export function MemberTimeEntriesList({
  organisationId,
  membershipId,
}: MemberTimeEntriesListProps) {
  const entriesQuery = useMemberTimeEntries(organisationId, membershipId, true);

  if (entriesQuery.isLoading) {
    return (
      <p className="flex items-center gap-2 text-slate-900">
        <Spinner className="text-primary-dark" />
        Loading timesheet…
      </p>
    );
  }

  if (entriesQuery.isError || !entriesQuery.data) {
    return (
      <ErrorMessage
        message={
          entriesQuery.error instanceof Error
            ? entriesQuery.error.message
            : "Could not load timesheet."
        }
      />
    );
  }

  if (entriesQuery.data.length === 0) {
    return <p className="text-slate-900">No hours logged yet.</p>;
  }

  return (
    <ul className="flex flex-col gap-2">
      {entriesQuery.data.map((entry) => (
        <li
          key={entry.id}
          className="rounded-md border border-input-border p-3 text-slate-900"
        >
          <p className="flex items-center gap-2 font-medium">
            <ProjectColourBadge colour={entry.projectColour} />
            {entry.projectName}
            {entry.taskName && (
              <span className="text-slate-900/70">— {entry.taskName}</span>
            )}
          </p>
          <p className="text-sm text-slate-900/70">
            {new Date(entry.startedAt).toLocaleString()}
            {entry.endedAt && ` – ${new Date(entry.endedAt).toLocaleString()}`}
          </p>
          <p className="text-sm">
            {entry.durationSeconds === null
              ? "In progress"
              : formatDuration(Math.round(entry.durationSeconds / 60))}
          </p>
        </li>
      ))}
    </ul>
  );
}
