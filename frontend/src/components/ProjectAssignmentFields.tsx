"use client";

import { useAssignableProjectMembers } from "@/hooks/useAssignableProjectMembers";
import { useAssignableProjectTeams } from "@/hooks/useAssignableProjectTeams";
import { PROJECT_MEMBERSHIP_ROLE_OPTIONS } from "@/lib/projectMembershipRoleOptions";
import type { ProjectMembershipRole } from "@/types/project";
import { CheckboxField } from "@/components/ui/form/CheckboxField";
import { MemberSearchChecklist } from "@/components/MemberSearchChecklist";
import { MultiSelectDropdown } from "@/components/MultiSelectDropdown";

type ProjectAssignmentFieldsProps = {
  organisationId: string;
  projectId?: string;
  selectedMembers: Map<string, ProjectMembershipRole>;
  onMembersChange: (members: Map<string, ProjectMembershipRole>) => void;
  selectedTeamIds: Set<string>;
  onTeamIdsChange: (teamIds: Set<string>) => void;
};

function pluralCount(count: number, noun: string): string {
  return count === 0
    ? `Select ${noun}s`
    : `${count} ${noun}${count === 1 ? "" : "s"} selected`;
}

export function ProjectAssignmentFields({
  organisationId,
  projectId,
  selectedMembers,
  onMembersChange,
  selectedTeamIds,
  onTeamIdsChange,
}: ProjectAssignmentFieldsProps) {
  const membersQuery = useAssignableProjectMembers(organisationId, projectId);
  const teamsQuery = useAssignableProjectTeams(organisationId, projectId);
  const teams = teamsQuery.data ?? [];

  function toggleTeam(teamId: string, checked: boolean) {
    const next = new Set(selectedTeamIds);
    if (checked) {
      next.add(teamId);
    } else {
      next.delete(teamId);
    }
    onTeamIdsChange(next);
  }

  return (
    <div className="flex flex-col gap-5">
      <MultiSelectDropdown
        id="project-members"
        label="Members (optional)"
        triggerText={pluralCount(selectedMembers.size, "member")}
      >
        <MemberSearchChecklist
          roleOptions={PROJECT_MEMBERSHIP_ROLE_OPTIONS}
          candidates={membersQuery.data ?? []}
          selected={selectedMembers}
          isLoading={membersQuery.isLoading}
          emptyMessage="No active members in this organisation yet."
          onToggle={(id, checked) => {
            const next = new Map(selectedMembers);
            if (checked) {
              next.set(id, next.get(id) ?? "member");
            } else {
              next.delete(id);
            }
            onMembersChange(next);
          }}
          onRoleChange={(id, role) =>
            onMembersChange(new Map(selectedMembers).set(id, role))
          }
        />
      </MultiSelectDropdown>

      <MultiSelectDropdown
        id="project-teams"
        label="Teams (optional)"
        triggerText={pluralCount(selectedTeamIds.size, "team")}
      >
        {teamsQuery.isLoading ? (
          <p className="text-sm text-slate-900">Loading teams…</p>
        ) : (
          <ul className="flex max-h-64 flex-col gap-2 overflow-y-auto">
            {teams.map((team) => (
              <li key={team.id}>
                <CheckboxField
                  label={team.name}
                  className="rounded-md border border-input-border px-3 py-2"
                  checked={selectedTeamIds.has(team.id)}
                  onChange={(event) =>
                    toggleTeam(team.id, event.target.checked)
                  }
                />
              </li>
            ))}
            {teams.length === 0 && (
              <li className="text-slate-900">
                No teams in this organisation yet.
              </li>
            )}
          </ul>
        )}
      </MultiSelectDropdown>
    </div>
  );
}
