"use client";

import { InviteMemberForm } from "./InviteMemberForm";
import { Modal } from "./Modal";

type InviteMemberModalProps = {
  organisationId: string;
  onClose: () => void;
};

export function InviteMemberModal({
  organisationId,
  onClose,
}: InviteMemberModalProps) {
  return (
    <Modal title="Invite people" onClose={onClose}>
      <InviteMemberForm organisationId={organisationId} />
    </Modal>
  );
}
