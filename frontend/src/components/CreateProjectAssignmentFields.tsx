"use client";

import { useAssignableProjectMembers } from "@/hooks/useAssignableProjectMembers";
import { useAssignableProjectTeams } from "@/hooks/useAssignableProjectTeams";
import type { ProjectMembershipRole } from "@/types/project";
import { MemberSearchChecklist } from "./MemberSearchChecklist";
import { MultiSelectDropdown } from "./MultiSelectDropdown";

type CreateProjectAssignmentFieldsProps = {
  organisationId: string;
  selectedMembers: Map<string, ProjectMembershipRole>;
  onMembersChange: (members: Map<string, ProjectMembershipRole>) => void;
  selectedTeamIds: Set<string>;
  onTeamIdsChange: (teamIds: Set<string>) => void;
};

function pluralCount(count: number, noun: string): string {
  return count === 0 ? `Select ${noun}s` : `${count} ${noun}${count === 1 ? "" : "s"} selected`;
}

/** Optional member/team assignment shown on the create-project form —
 * separate from the per-project "add members"/"add teams" pickers used
 * after creation, since there's no :projectId yet to scope the request to. */
export function CreateProjectAssignmentFields({
  organisationId,
  selectedMembers,
  onMembersChange,
  selectedTeamIds,
  onTeamIdsChange,
}: CreateProjectAssignmentFieldsProps) {
  const membersQuery = useAssignableProjectMembers(organisationId);
  const teamsQuery = useAssignableProjectTeams(organisationId);
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
        id="create-project-members"
        label="Members (optional)"
        triggerText={pluralCount(selectedMembers.size, "member")}
      >
        <MemberSearchChecklist
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
        id="create-project-teams"
        label="Teams (optional)"
        triggerText={pluralCount(selectedTeamIds.size, "team")}
      >
        {teamsQuery.isLoading ? (
          <p className="text-sm text-slate-900">Loading teams…</p>
        ) : (
          <ul className="flex max-h-64 flex-col gap-2 overflow-y-auto">
            {teams.map((team) => (
              <li key={team.id}>
                <label className="flex items-center gap-2 rounded-md border border-input-border px-3 py-2 text-slate-900">
                  <input
                    type="checkbox"
                    checked={selectedTeamIds.has(team.id)}
                    onChange={(event) => toggleTeam(team.id, event.target.checked)}
                    className="size-4"
                  />
                  {team.name}
                </label>
              </li>
            ))}
            {teams.length === 0 && (
              <li className="text-slate-900">No teams in this organisation yet.</li>
            )}
          </ul>
        )}
      </MultiSelectDropdown>
    </div>
  );
}
