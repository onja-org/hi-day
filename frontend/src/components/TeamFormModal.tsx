"use client";

import type { OrganisationTeam } from "@/types/team";
import { Modal } from "./Modal";
import { TeamForm } from "./TeamForm";

type TeamFormModalProps = {
  organisationId: string;
  onClose: () => void;
  onSaved: (team: OrganisationTeam) => void;
};

export function TeamFormModal({
  organisationId,
  onClose,
  onSaved,
}: TeamFormModalProps) {
  return (
    <Modal title="New team" onClose={onClose}>
      <TeamForm organisationId={organisationId} onSaved={onSaved} />
    </Modal>
  );
}
