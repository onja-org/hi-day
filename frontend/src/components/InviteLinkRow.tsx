"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { INVITE_LINKS_QUERY_KEY } from "@/hooks/useInviteLinks";
import { buildInviteLinkUrl } from "@/lib/buildInviteLinkUrl";
import { deleteInviteLink } from "@/lib/deleteInviteLink";
import { formatInviteLinkUsage } from "@/lib/formatInviteLinkUsage";
import { formatMembershipRole } from "@/lib/formatMembershipRole";
import { formatShortDate } from "@/lib/formatShortDate";
import { getInitials } from "@/lib/getInitials";
import { saveInviteLink } from "@/lib/saveInviteLink";
import type { InviteLink } from "@/types/inviteLink";
import { ActionsMenu } from "./ActionsMenu";
import { AvatarStack } from "./AvatarStack";
import { ConfirmDialog } from "./ConfirmDialog";
import { InviteLinkFormModal } from "./InviteLinkFormModal";
import { InviteLinkStatusBadge } from "./InviteLinkStatusBadge";

type InviteLinkRowProps = {
  organisationId: string;
  link: InviteLink;
  teamNames: Map<string, string>;
};

export function InviteLinkRow({ organisationId, link, teamNames }: InviteLinkRowProps) {
  const queryClient = useQueryClient();
  const [openModal, setOpenModal] = useState<"edit" | "delete" | null>(null);
  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: INVITE_LINKS_QUERY_KEY(organisationId) });

  // Copying isn't an API call, so it returns its own { ok, message } for the toast.
  const copyMutation = useMutation({
    mutationFn: async () => {
      try {
        await navigator.clipboard.writeText(buildInviteLinkUrl(window.location.origin, link.token));
        return { ok: true, message: "Invite link copied" };
      } catch {
        return { ok: false, message: "Couldn't copy the link — your browser blocked clipboard access." };
      }
    },
  });
  const toggleMutation = useMutation({
    mutationFn: () => saveInviteLink(organisationId, { enabled: !link.enabled }, link.id),
    onSuccess: invalidate,
  });
  const deleteMutation = useMutation({
    mutationFn: () => deleteInviteLink(organisationId, link.id),
    onSuccess: (result) => {
      invalidate();
      if (result.ok) setOpenModal(null);
    },
  });

  return (
    <tr className="border-b border-input-border last:border-b-0 hover:bg-cream/30">
      <td className="px-4 py-3 font-medium text-slate-900">{link.name}</td>
      <td className="hidden px-4 py-3 text-slate-900 sm:table-cell">{formatMembershipRole(link.role)}</td>
      <td className="hidden px-4 py-3 md:table-cell">
        <AvatarStack
          tone="secondary"
          items={link.teamIds.map((teamId) => {
            const name = teamNames.get(teamId) ?? "Team";
            return { id: teamId, label: name, initials: getInitials(name).charAt(0) };
          })}
        />
      </td>
      <td className="hidden px-4 py-3 text-slate-900 md:table-cell">{link.projectIds.length}</td>
      <td className="hidden px-4 py-3 whitespace-nowrap text-slate-900 lg:table-cell">
        {link.expiresAt ? formatShortDate(link.expiresAt) : <span className="text-slate-900/60">No expiration</span>}
      </td>
      <td className="hidden px-4 py-3 text-slate-900 tabular-nums lg:table-cell">
        {formatInviteLinkUsage(link.usageCount, link.usageCap)}
      </td>
      <td className="px-4 py-3">
        <InviteLinkStatusBadge status={link.status} />
      </td>
      <td className="px-4 py-3 text-right whitespace-nowrap">
        <ActionsMenu
          items={[
            { label: "Copy link", onSelect: () => copyMutation.mutate() },
            { label: "Edit link", onSelect: () => setOpenModal("edit") },
            {
              label: link.enabled ? "Disable link" : "Enable link",
              onSelect: () => toggleMutation.mutate(),
              disabled: toggleMutation.isPending,
            },
            { label: "Delete link", onSelect: () => setOpenModal("delete"), tone: "danger" },
          ]}
        />
        {openModal === "edit" && (
          <InviteLinkFormModal organisationId={organisationId} link={link} onClose={() => setOpenModal(null)} />
        )}
        {openModal === "delete" && (
          <ConfirmDialog
            title="Delete invite link"
            message={`Delete "${link.name}"? The link stops working straight away, and invitations people requested through it but haven't accepted yet are revoked. People who already joined are unaffected.`}
            confirmLabel="Delete"
            isDangerous
            isPending={deleteMutation.isPending}
            onConfirm={() => deleteMutation.mutate()}
            onClose={() => setOpenModal(null)}
          />
        )}
      </td>
    </tr>
  );
}
