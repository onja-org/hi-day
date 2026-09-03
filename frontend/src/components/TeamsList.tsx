"use client";

import { useState } from "react";
import type { FormEvent } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useCurrentOrganisation } from "@/hooks/useCurrentOrganisation";
import {
  ORGANISATION_TEAMS_QUERY_KEY,
  useOrganisationTeams,
} from "@/hooks/useOrganisationTeams";
import { createTeam } from "@/lib/createTeam";
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
  const [name, setName] = useState("");
  const [deletingTeamId, setDeletingTeamId] = useState<string | null>(null);

  const isAdmin = organisationQuery.data?.role === "admin";
  const queryKey = ORGANISATION_TEAMS_QUERY_KEY(organisationId);

  const createMutation = useMutation({
    mutationFn: (teamName: string) => createTeam(organisationId, teamName),
    onSuccess: (result) => {
      if (result.ok) {
        setName("");
        queryClient.invalidateQueries({ queryKey });
      }
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (teamId: string) => deleteTeam(organisationId, teamId),
    onSuccess: (result) => {
      if (result.ok) {
        queryClient.invalidateQueries({ queryKey });
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

  function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      return;
    }
    createMutation.mutate(trimmed);
  }

  const createError =
    createMutation.data && !createMutation.data.ok
      ? createMutation.data.message
      : null;
  const deleteError =
    deleteMutation.data && !deleteMutation.data.ok
      ? deleteMutation.data.message
      : null;
  const teamPendingDelete = teamsQuery.data.find(
    (team) => team.id === deletingTeamId,
  );

  return (
    <div className="flex flex-col gap-4">
      {isAdmin && (
        <form onSubmit={handleCreate} className="flex gap-3">
          <label className="sr-only" htmlFor="new-team-name">
            Team name
          </label>
          <input
            id="new-team-name"
            type="text"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="New team name"
            className="rounded-md border border-input-border px-3 py-2 text-sm text-slate-900"
          />
          <button
            type="submit"
            disabled={createMutation.isPending}
            className="cursor-pointer rounded-md bg-primary px-4 py-2 text-sm text-white transition-colors duration-150 hover:bg-primary/90 disabled:cursor-not-allowed disabled:bg-primary/50"
          >
            New team
          </button>
        </form>
      )}

      {createError && <ErrorMessage message={createError} />}
      {deleteError && <ErrorMessage message={deleteError} />}

      {teamsQuery.data.length === 0 ? (
        <p className="text-slate-900">No teams yet.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {teamsQuery.data.map((team) => (
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
