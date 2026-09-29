"use client";

import { useMutation } from "@tanstack/react-query";
import { useInvalidateTeams } from "@/hooks/useInvalidateTeams";
import { addTeamMember } from "@/lib/addTeamMember";
import { removeTeamMember } from "@/lib/removeTeamMember";
import type { TeamMember } from "@/types/team";

type TeamMemberRowProps = {
  organisationId: string;
  teamId: string;
  member: TeamMember;
  canManage: boolean;
};

export function TeamMemberRow({
  organisationId,
  teamId,
  member,
  canManage,
}: TeamMemberRowProps) {
  const invalidate = useInvalidateTeams(organisationId);

  const toggleManagerMutation = useMutation({
    mutationFn: (isManager: boolean) =>
      addTeamMember(organisationId, teamId, {
        membershipId: member.membershipId,
        isManager,
      }),
    onSuccess: (result) => {
      if (result.ok) {
        invalidate();
      }
    },
  });

  const removeMutation = useMutation({
    mutationFn: () => removeTeamMember(organisationId, teamId, member.membershipId),
    onSuccess: (result) => {
      if (result.ok) {
        invalidate();
      }
    },
  });

  return (
    <li className="flex items-center justify-between gap-3 rounded-md border border-input-border px-3 py-2 text-slate-900">
      <span>
        {member.name ?? member.email}
        {member.name && (
          <span className="block text-xs text-slate-900/70">{member.email}</span>
        )}
      </span>
      <div className="flex items-center gap-4">
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={member.isManager}
            onChange={(event) => toggleManagerMutation.mutate(event.target.checked)}
            disabled={!canManage || toggleManagerMutation.isPending}
          />
          Manager
        </label>
        {canManage && (
          <button
            type="button"
            onClick={() => removeMutation.mutate()}
            disabled={removeMutation.isPending}
            className="cursor-pointer text-error underline disabled:cursor-not-allowed disabled:opacity-50"
          >
            Remove
          </button>
        )}
      </div>
    </li>
  );
}
