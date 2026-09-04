"use client";

import { useState } from "react";
import { useCurrentOrganisation } from "@/hooks/useCurrentOrganisation";
import { useTeamDetail } from "@/hooks/useTeamDetail";
import { AddTeamMemberModal } from "./AddTeamMemberModal";
import { ErrorMessage } from "./ErrorMessage";
import { Spinner } from "./Spinner";
import { TeamMemberRow } from "./TeamMemberRow";
import { TeamRenameForm } from "./TeamRenameForm";

type TeamDetailProps = {
  organisationId: string;
  teamId: string;
};

export function TeamDetail({ organisationId, teamId }: TeamDetailProps) {
  const teamQuery = useTeamDetail(organisationId, teamId);
  const organisationQuery = useCurrentOrganisation();
  const [isAddingMember, setIsAddingMember] = useState(false);

  if (teamQuery.isLoading) {
    return (
      <p className="flex items-center gap-2 text-slate-900">
        <Spinner className="text-primary-dark" />
        Loading team…
      </p>
    );
  }

  if (teamQuery.isError || !teamQuery.data) {
    return (
      <ErrorMessage
        message={
          teamQuery.error instanceof Error
            ? teamQuery.error.message
            : "Could not load team."
        }
      />
    );
  }

  const team = teamQuery.data;
  const isAdmin = organisationQuery.data?.role === "admin";
  const callerUserId = organisationQuery.data?.userId;
  const isTeamManager = team.members.some(
    (member) => member.userId === callerUserId && member.isManager,
  );
  const canManageMembers = isAdmin || isTeamManager;

  return (
    <div className="flex flex-col gap-8">
      {isAdmin ? (
        <TeamRenameForm
          organisationId={organisationId}
          teamId={teamId}
          currentName={team.name}
        />
      ) : (
        <h1 className="text-2xl font-semibold text-primary-dark">{team.name}</h1>
      )}

      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-primary-dark">Members</h2>
          {canManageMembers && (
            <button
              type="button"
              onClick={() => setIsAddingMember(true)}
              className="cursor-pointer rounded-md bg-primary px-4 py-2 text-sm text-white transition-colors duration-150 hover:bg-primary/90"
            >
              Add member
            </button>
          )}
        </div>

        {team.members.length === 0 ? (
          <p className="text-slate-900">No members on this team yet.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {team.members.map((member) => (
              <TeamMemberRow
                key={member.membershipId}
                organisationId={organisationId}
                teamId={teamId}
                member={member}
                canManage={canManageMembers}
              />
            ))}
          </ul>
        )}
      </div>

      {isAddingMember && (
        <AddTeamMemberModal
          organisationId={organisationId}
          teamId={teamId}
          existingMembers={team.members}
          onClose={() => setIsAddingMember(false)}
        />
      )}
    </div>
  );
}
