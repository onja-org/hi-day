"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useCurrentOrganisation } from "@/hooks/useCurrentOrganisation";
import {
  ORGANISATION_TEAMS_QUERY_KEY,
  useOrganisationTeams,
} from "@/hooks/useOrganisationTeams";
import { deleteTeam } from "@/lib/deleteTeam";
import { ConfirmDialog } from "./ConfirmDialog";
import { ErrorMessage } from "./ErrorMessage";
import { Spinner } from "./Spinner";

type TeamsListProps = {
  organisationId: string;
};

export function TeamsList({ organisationId }: TeamsListProps) {
  const queryClient = useQueryClient();
  const organisationQuery = useCurrentOrganisation();
  const teamsQuery = useOrganisationTeams(organisationId);
  const [search, setSearch] = useState("");
  const [deletingTeamId, setDeletingTeamId] = useState<string | null>(null);

  const isAdmin = organisationQuery.data?.role === "admin";

  const deleteMutation = useMutation({
    mutationFn: (teamId: string) => deleteTeam(organisationId, teamId),
    onSuccess: (result) => {
      if (result.ok) {
        queryClient.invalidateQueries({
          queryKey: ORGANISATION_TEAMS_QUERY_KEY(organisationId),
        });
      }
      setDeletingTeamId(null);
    },
  });

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

  const search_ = search.trim().toLowerCase();
  const teams = teamsQuery.data.filter((team) =>
    search_ ? team.name.toLowerCase().includes(search_) : true,
  );

  const deleteError =
    deleteMutation.data && !deleteMutation.data.ok
      ? deleteMutation.data.message
      : null;
  const teamPendingDelete = teamsQuery.data.find(
    (team) => team.id === deletingTeamId,
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <label htmlFor="team-search" className="sr-only">
          Search teams
        </label>
        <input
          id="team-search"
          type="search"
          placeholder="Search by name"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          className="rounded-md border border-input-border px-3 py-2 text-sm text-slate-900 sm:w-64"
        />
      </div>

      {deleteError && <ErrorMessage message={deleteError} />}

      {teams.length === 0 ? (
        <p className="text-slate-900">
          {teamsQuery.data.length === 0
            ? "No teams yet."
            : "No teams match your search."}
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {teams.map((team) => (
            <li
              key={team.id}
              className="flex items-center justify-between gap-3 rounded-md border border-input-border px-3 py-2 text-slate-900"
            >
              {isAdmin ? (
                <Link
                  href={`/organisations/${organisationId}/teams/${team.id}`}
                  className="hover:underline"
                >
                  {team.name}
                </Link>
              ) : (
                <span>{team.name}</span>
              )}
              {isAdmin && (
                <button
                  type="button"
                  onClick={() => setDeletingTeamId(team.id)}
                  className="cursor-pointer text-error underline"
                >
                  Delete
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      {teamPendingDelete && (
        <ConfirmDialog
          title="Delete team"
          message={`Delete "${teamPendingDelete.name}"? Members are detached, not removed — their accounts and history are unaffected.`}
          confirmLabel="Delete"
          isDangerous
          isPending={deleteMutation.isPending}
          onConfirm={() => deleteMutation.mutate(teamPendingDelete.id)}
          onClose={() => setDeletingTeamId(null)}
        />
      )}
    </div>
  );
}
