"use client";

import { Modal } from "./Modal";
import { TeamDetail } from "./TeamDetail";

type TeamMembersModalProps = {
  organisationId: string;
  teamId: string;
  teamName: string;
  onClose: () => void;
};

/** The team page's roster (and, for an admin, rename) in a modal, so a
 * team can be managed straight from the Teams list. */
export function TeamMembersModal({ organisationId, teamId, teamName, onClose }: TeamMembersModalProps) {
  return (
    <Modal title={`Edit members · ${teamName}`} onClose={onClose} size="wide">
      <TeamDetail organisationId={organisationId} teamId={teamId} showName={false} />
    </Modal>
  );
}
