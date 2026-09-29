"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useInvalidateTeams } from "@/hooks/useInvalidateTeams";
import { updateMembership } from "@/lib/updateMembership";
import type { ActiveMemberListItem, MembershipRole } from "@/types/membership";
import { ActionsMenu } from "./ActionsMenu";
import { ConfirmDialog } from "./ConfirmDialog";
import { EditMemberAssignmentsModal } from "./EditMemberAssignmentsModal";
import { EditMemberNameModal } from "./EditMemberNameModal";
import { EditMemberRoleModal } from "./EditMemberRoleModal";
import { SendPasswordResetDialog } from "./SendPasswordResetDialog";

type MemberRowActionsProps = {
  organisationId: string;
  member: ActiveMemberListItem;
  callerRole: MembershipRole;
  isSelf: boolean;
};

type OpenModal = "name" | "role" | "assignments" | "reset" | "remove" | null;

const ADMIN_ASSIGNABLE_ROLES: MembershipRole[] = ["admin", "manager", "member"];
const MANAGER_ASSIGNABLE_ROLES: MembershipRole[] = ["manager", "member"];

export function MemberRowActions({ organisationId, member, callerRole, isSelf }: MemberRowActionsProps) {
  const [openModal, setOpenModal] = useState<OpenModal>(null);
  const invalidate = useInvalidateTeams(organisationId);
  const close = () => setOpenModal(null);

  const isAdmin = callerRole === "admin";
  const isManager = callerRole === "manager";
  // Mirrors MembershipsService.update: nobody changes their own role or
  // removes themselves, managers never touch an admin (or grant admin),
  // and a manager can't modify their own membership at all. An admin may
  // still edit their own name.
  const canModify = !isSelf && (isAdmin || (isManager && member.role !== "admin"));
  const canEditOwnDetails = isSelf && isAdmin;
  const lockedTitle = isSelf
    ? "You can't change this for your own membership"
    : "Only an admin can change an admin's membership";
  const locked = (allowed: boolean) => ({
    disabled: !allowed,
    title: allowed ? undefined : lockedTitle,
  });

  const removeMutation = useMutation({
    mutationFn: () => updateMembership(organisationId, member.id, { deactivate: true }),
    onSuccess: (result) => {
      if (result.ok) {
        invalidate();
        close();
      }
    },
  });

  const label = member.name ?? member.email;

  return (
    <>
      <ActionsMenu
        items={[
          { label: "Edit member", onSelect: () => setOpenModal("name"), ...locked(canModify || canEditOwnDetails) },
          { label: "Edit role", onSelect: () => setOpenModal("role"), ...locked(canModify) },
          { label: "Edit teams & projects", onSelect: () => setOpenModal("assignments"), ...locked(canModify || isAdmin) },
          { label: "Send password reset", onSelect: () => setOpenModal("reset"), ...locked(canModify) },
          { label: "Remove member", onSelect: () => setOpenModal("remove"), tone: "danger" as const, ...locked(canModify) },
        ]}
      />

      {openModal === "name" && (
        <EditMemberNameModal organisationId={organisationId} member={member} onClose={close} />
      )}
      {openModal === "role" && (
        <EditMemberRoleModal
          organisationId={organisationId}
          member={member}
          availableRoles={isAdmin ? ADMIN_ASSIGNABLE_ROLES : MANAGER_ASSIGNABLE_ROLES}
          onClose={close}
        />
      )}
      {openModal === "assignments" && (
        <EditMemberAssignmentsModal organisationId={organisationId} member={member} onClose={close} />
      )}
      {openModal === "reset" && (
        <SendPasswordResetDialog
          organisationId={organisationId}
          membershipIds={[member.id]}
          recipientLabel={label}
          onClose={close}
        />
      )}
      {openModal === "remove" && (
        <ConfirmDialog
          title="Remove member"
          message={`Remove ${label} from this organisation? They lose access straight away and are signed out of their devices. Their tracked time and history stay intact.`}
          confirmLabel="Remove"
          isDangerous
          isPending={removeMutation.isPending}
          onConfirm={() => removeMutation.mutate()}
          onClose={close}
        />
      )}
    </>
  );
}
