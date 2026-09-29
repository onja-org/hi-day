"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useCurrentOrganisation } from "@/hooks/useCurrentOrganisation";
import { useInvalidateTeams } from "@/hooks/useInvalidateTeams";
import { useOrganisationTeams } from "@/hooks/useOrganisationTeams";
import { deleteTeam } from "@/lib/deleteTeam";
import { matchesSearch } from "@/lib/matchesSearch";
import { ConfirmDialog } from "./ConfirmDialog";
import { ErrorMessage } from "./ErrorMessage";
import { Spinner } from "./Spinner";
import { TeamListRow } from "./TeamListRow";

type TeamsListProps = {
  organisationId: string;
  search: string;
};

export function TeamsList({ organisationId, search }: TeamsListProps) {
  const organisationQuery = useCurrentOrganisation();
  const teamsQuery = useOrganisationTeams(organisationId);
  const invalidate = useInvalidateTeams(organisationId);
  const [deletingTeamId, setDeletingTeamId] = useState<string | null>(null);

  const isAdmin = organisationQuery.data?.role === "admin";
  const callerUserId = organisationQuery.data?.userId;

  const deleteMutation = useMutation({
    mutationFn: (teamId: string) => deleteTeam(organisationId, teamId),
    onSuccess: (result) => {
      if (result.ok) invalidate();
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
          teamsQuery.error instanceof Error ? teamsQuery.error.message : "Could not load teams."
        }
      />
    );
  }

  const teams = teamsQuery.data.filter((team) => matchesSearch([team.name], search));
  const teamPendingDelete = teamsQuery.data.find((team) => team.id === deletingTeamId);

  return (
    <>
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-input-border text-primary-dark">
            <th className="px-4 py-3 font-semibold">Name</th>
            <th className="hidden px-4 py-3 font-semibold sm:table-cell">Members</th>
            <th className="hidden px-4 py-3 font-semibold md:table-cell">Projects</th>
            <th className="px-4 py-3 font-semibold">
              <span className="sr-only">Actions</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {teams.map((team) => (
            <TeamListRow
              key={team.id}
              organisationId={organisationId}
              team={team}
              isAdmin={isAdmin}
              canManageMembers={
                isAdmin ||
                team.members.some((member) => member.userId === callerUserId && member.isManager)
              }
              onDelete={() => setDeletingTeamId(team.id)}
            />
          ))}
          {teams.length === 0 && (
            <tr>
              <td colSpan={4} className="px-4 py-8 text-center text-slate-900">
                {teamsQuery.data.length === 0 ? "No teams yet." : "No teams match your search."}
              </td>
            </tr>
          )}
        </tbody>
      </table>

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
    </>
  );
}
