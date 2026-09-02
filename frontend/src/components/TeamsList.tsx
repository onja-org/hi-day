"use client";

import { useOrganisationTeams } from "@/hooks/useOrganisationTeams";
import { ErrorMessage } from "./ErrorMessage";
import { Spinner } from "./Spinner";

type TeamsListProps = {
  organisationId: string;
};

export function TeamsList({ organisationId }: TeamsListProps) {
  const teamsQuery = useOrganisationTeams(organisationId);

  if (teamsQuery.isLoading) {
    return (
      <p className="flex items-center gap-2 text-slate-900">
        <Spinner className="text-primary-dark" />
        Loading teams…
      </p>
    );
  }

  if (teamsQuery.isError || !teamsQuery.data) {
    return (
      <ErrorMessage
        message={
          teamsQuery.error instanceof Error
            ? teamsQuery.error.message
            : "Could not load teams."
        }
      />
    );
  }

  if (teamsQuery.data.length === 0) {
    return <p className="text-slate-900">No teams yet.</p>;
  }

  return (
    <ul className="flex flex-col gap-2">
      {teamsQuery.data.map((team) => (
        <li
          key={team.id}
          className="rounded-md border border-input-border px-3 py-2 text-slate-900"
        >
          {team.name}
        </li>
      ))}
    </ul>
  );
}
