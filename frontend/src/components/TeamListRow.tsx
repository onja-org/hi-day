"use client";

import { useState } from "react";
import Link from "next/link";
import { getInitials } from "@/lib/getInitials";
import type { TeamOverview } from "@/types/team";
import { useProjectsEnabled } from "@/hooks/useProjectsEnabled";
import { ActionsMenu } from "./ActionsMenu";
import { AvatarStack } from "./AvatarStack";
import { EditIconButton } from "./EditIconButton";
import { EditTeamModal } from "./EditTeamModal";
import { TeamMembersModal } from "./TeamMembersModal";

type TeamListRowProps = {
  organisationId: string;
  team: TeamOverview;
  isAdmin: boolean;
  /** An org admin, or one of this team's own managers. */
  canManageMembers: boolean;
  onDelete: () => void;
};

export function TeamListRow({
  organisationId,
  team,
  isAdmin,
  canManageMembers,
  onDelete,
}: TeamListRowProps) {
  const projectsEnabled = useProjectsEnabled();
  const [editingMembers, setEditingMembers] = useState(false);
  const [editingTeam, setEditingTeam] = useState(false);
  const teamHref = `/organisations/${organisationId}/teams/${team.id}`;

  return (
    <tr className="group border-b border-input-border last:border-b-0 hover:bg-cream/30">
      <td className="px-4 py-3">
        <Link
          href={teamHref}
          className="flex w-fit items-center gap-3 font-medium text-primary hover:text-primary/80"
        >
          <span
            aria-hidden="true"
            className="flex size-8 shrink-0 items-center justify-center rounded-full bg-secondary text-sm font-semibold text-white"
          >
            {getInitials(team.name).charAt(0)}
          </span>
          {team.name}
        </Link>
      </td>
      <td className="hidden px-4 py-3 sm:table-cell">
        <div className="flex items-center gap-1.5">
          <AvatarStack
            items={team.members.map((member) => ({
              id: member.membershipId,
              label: member.name ?? member.email,
              initials: getInitials(member.name, member.email),
            }))}
          />
          {canManageMembers && (
            <EditIconButton
              label="Edit this team's members"
              accessibleName={`Edit ${team.name}'s members`}
              onClick={() => setEditingMembers(true)}
            />
          )}
        </div>
      </td>
      {projectsEnabled && (
        <td className="hidden px-4 py-3 text-slate-900 md:table-cell">{team.projectCount}</td>
      )}
      <td className="px-4 py-3 text-right whitespace-nowrap">
        <ActionsMenu
          items={[
            { label: "View team", href: teamHref },
            ...(isAdmin ? [{ label: "Edit team", onSelect: () => setEditingTeam(true) }] : []),
            ...(canManageMembers
              ? [{ label: "Manage members", onSelect: () => setEditingMembers(true) }]
              : []),
            ...(isAdmin
              ? [{ label: "Delete team", onSelect: onDelete, tone: "danger" as const }]
              : []),
          ]}
        />
        {editingTeam && (
          <EditTeamModal
            organisationId={organisationId}
            teamId={team.id}
            currentName={team.name}
            onClose={() => setEditingTeam(false)}
          />
        )}
        {editingMembers && (
          <TeamMembersModal
            organisationId={organisationId}
            teamId={team.id}
            teamName={team.name}
            onClose={() => setEditingMembers(false)}
          />
        )}
      </td>
    </tr>
  );
}
