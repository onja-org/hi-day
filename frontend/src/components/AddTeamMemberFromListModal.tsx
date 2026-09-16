"use client";

import { useTeamDetail } from "@/hooks/useTeamDetail";
import { AddTeamMemberModal } from "./AddTeamMemberModal";
import { ErrorMessage } from "./ErrorMessage";
import { Modal } from "./Modal";
import { Spinner } from "./Spinner";

type AddTeamMemberFromListModalProps = {
  organisationId: string;
  teamId: string;
  onClose: () => void;
};

/** AddTeamMemberModal needs the team's current members to exclude them from
 * the candidate list — the detail page already has those loaded, but the
 * Teams list only has team id/name. This loads the team's detail first so
 * "Add member" can be triggered straight from the list. */
export function AddTeamMemberFromListModal({
  organisationId,
  teamId,
  onClose,
}: AddTeamMemberFromListModalProps) {
  const teamQuery = useTeamDetail(organisationId, teamId);

  if (teamQuery.isLoading) {
    return (
      <Modal title="Add member" onClose={onClose}>
        <p className="flex items-center gap-2 text-slate-900">
          <Spinner className="text-primary-dark" />
          Loading team…
        </p>
      </Modal>
    );
  }

  if (teamQuery.isError || !teamQuery.data) {
    return (
      <Modal title="Add member" onClose={onClose}>
        <ErrorMessage
          message={
            teamQuery.error instanceof Error
              ? teamQuery.error.message
              : "Could not load this team."
          }
        />
      </Modal>
    );
  }

  return (
    <AddTeamMemberModal
      organisationId={organisationId}
      teamId={teamId}
      existingMembers={teamQuery.data.members}
      onClose={onClose}
    />
  );
}
