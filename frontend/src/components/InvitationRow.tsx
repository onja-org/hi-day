"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { PENDING_INVITATIONS_QUERY_KEY } from "@/hooks/usePendingInvitations";
import { useProjectsEnabled } from "@/hooks/useProjectsEnabled";
import { formatMembershipRole } from "@/lib/formatMembershipRole";
import { formatShortDate } from "@/lib/formatShortDate";
import { getInitials } from "@/lib/getInitials";
import { resendInvitation } from "@/lib/resendInvitation";
import { revokeInvitation } from "@/lib/revokeInvitation";
import type { PendingInvitation } from "@/types/invitation";
import { ActionsMenu } from "./ActionsMenu";
import { AvatarStack } from "./AvatarStack";
import { InvitationStatusBadge } from "./InvitationStatusBadge";

type InvitationRowProps = {
  organisationId: string;
  invitation: PendingInvitation;
  /** Team id → name for the teams the caller can see. */
  teamNames: Map<string, string>;
};

export function InvitationRow({ organisationId, invitation, teamNames }: InvitationRowProps) {
  const projectsEnabled = useProjectsEnabled();
  const queryClient = useQueryClient();

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: PENDING_INVITATIONS_QUERY_KEY(organisationId) });
  }

  const resendMutation = useMutation({
    mutationFn: () => resendInvitation(organisationId, invitation.id),
    onSuccess: invalidate,
  });

  const revokeMutation = useMutation({
    mutationFn: () => revokeInvitation(organisationId, invitation.id),
    onSuccess: invalidate,
  });

  const isPending = resendMutation.isPending || revokeMutation.isPending;

  return (
    <tr className="border-b border-input-border last:border-b-0 hover:bg-cream/30">
      <td className="px-4 py-3">
        <div className="flex min-w-0 items-center gap-3">
          <span
            aria-hidden="true"
            className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary"
          >
            {getInitials(null, invitation.email)}
          </span>
          <span className="truncate text-slate-900">{invitation.email}</span>
        </div>
      </td>
      <td className="hidden px-4 py-3 text-slate-900 sm:table-cell">
        {formatMembershipRole(invitation.role)}
      </td>
      <td className="hidden px-4 py-3 md:table-cell">
        <AvatarStack
          tone="secondary"
          items={invitation.teamIds.map((teamId) => {
            const name = teamNames.get(teamId) ?? "Team";
            return { id: teamId, label: name, initials: getInitials(name).charAt(0) };
          })}
        />
      </td>
      {projectsEnabled && (
        <td className="hidden px-4 py-3 text-slate-900 md:table-cell">
          {invitation.projectIds.length}
        </td>
      )}
      <td className="hidden px-4 py-3 whitespace-nowrap text-slate-900 lg:table-cell">
        {formatShortDate(invitation.createdAt)}
      </td>
      <td className="px-4 py-3">
        <InvitationStatusBadge status={invitation.status} />
      </td>
      <td className="px-4 py-3 text-right whitespace-nowrap">
        <ActionsMenu
          items={[
            {
              label: "Resend invite",
              onSelect: () => resendMutation.mutate(),
              disabled: isPending,
            },
            {
              label: "Revoke invite",
              onSelect: () => revokeMutation.mutate(),
              disabled: isPending || invitation.status !== "pending",
              title:
                invitation.status === "pending"
                  ? undefined
                  : "Only a pending invite can be revoked",
              tone: "danger",
            },
          ]}
        />
      </td>
    </tr>
  );
}
