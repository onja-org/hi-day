"use client";

import { useMutation } from "@tanstack/react-query";
import { useInvalidateTeams } from "@/hooks/useInvalidateTeams";
import { addTeamMember } from "@/lib/addTeamMember";
import { removeTeamMember } from "@/lib/removeTeamMember";
import { teamMemberActionRefusal } from "@/lib/teamMemberPermissions.generated";
import type { TeamMember } from "@/types/team";
import { CheckboxField } from "@/components/ui/form/CheckboxField";

type TeamMemberRowProps = {
  organisationId: string;
  teamId: string;
  member: TeamMember;
  /** Whether the viewer manages this team (or runs the organisation). */
  canManage: boolean;
  isOrgAdmin: boolean;
};

export function TeamMemberRow({
  organisationId,
  teamId,
  member,
  canManage,
  isOrgAdmin,
}: TeamMemberRowProps) {
  const invalidate = useInvalidateTeams(organisationId);
  // The same rule the API answers with, so the tooltip and the 403 agree.
  const refusal = teamMemberActionRefusal(
    { isOrgAdmin, managesThisTeam: canManage },
    { isOrgAdmin: member.role === "admin" },
  );

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
    mutationFn: () =>
      removeTeamMember(organisationId, teamId, member.membershipId),
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
          <span className="block text-xs text-slate-900/70">
            {member.email}
          </span>
        )}
      </span>
      <div className="flex items-center gap-4">
        <CheckboxField
          label="Manager"
          className="text-sm"
          checked={member.isManager}
          onChange={(event) =>
            toggleManagerMutation.mutate(event.target.checked)
          }
          disabled={
            refusal !== null || !canManage || toggleManagerMutation.isPending
          }
          title={refusal ?? undefined}
        />
        {canManage && (
          <button
            type="button"
            onClick={() => removeMutation.mutate()}
            disabled={refusal !== null || removeMutation.isPending}
            title={refusal ?? undefined}
            className="cursor-pointer text-error underline disabled:cursor-not-allowed disabled:opacity-50 disabled:no-underline"
          >
            Remove
          </button>
        )}
      </div>
    </li>
  );
}
