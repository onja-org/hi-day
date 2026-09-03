"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { TEAM_DETAIL_QUERY_KEY } from "@/hooks/useTeamDetail";
import { addTeamMember } from "@/lib/addTeamMember";
import { removeTeamMember } from "@/lib/removeTeamMember";
import type { TeamMember } from "@/types/team";

type TeamMemberRowProps = {
  organisationId: string;
  teamId: string;
  member: TeamMember;
};

export function TeamMemberRow({
  organisationId,
  teamId,
  member,
}: TeamMemberRowProps) {
  const queryClient = useQueryClient();
  const queryKey = TEAM_DETAIL_QUERY_KEY(organisationId, teamId);

  const toggleManagerMutation = useMutation({
    mutationFn: (isManager: boolean) =>
      addTeamMember(organisationId, teamId, {
        membershipId: member.membershipId,
        isManager,
      }),
    onSuccess: (result) => {
      if (result.ok) {
        queryClient.invalidateQueries({ queryKey });
      }
    },
  });

  const removeMutation = useMutation({
    mutationFn: () => removeTeamMember(organisationId, teamId, member.membershipId),
    onSuccess: (result) => {
      if (result.ok) {
        queryClient.invalidateQueries({ queryKey });
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
            disabled={toggleManagerMutation.isPending}
          />
          Manager
        </label>
        <button
          type="button"
          onClick={() => removeMutation.mutate()}
          disabled={removeMutation.isPending}
          className="cursor-pointer text-error underline disabled:cursor-not-allowed disabled:opacity-50"
        >
          Remove
        </button>
      </div>
    </li>
  );
}
