import type {
  CreateProjectMemberInput,
  ProjectMember,
  ProjectMembershipRole,
  ProjectTeamMember,
} from "@/types/project";

export type ProjectAssignmentDiff = {
  membersToAdd: CreateProjectMemberInput[];
  membershipIdsToRemove: string[];
  membersToUpdateRole: { membershipId: string; role: ProjectMembershipRole }[];
  teamIdsToAdd: string[];
  teamIdsToRemove: string[];
};

/**
 * Compares the edit form's checked-member/team selections against a
 * project's current assignments, so saving only issues the add/remove/
 * role-change requests the change actually needs instead of clearing and
 * re-adding everything.
 */
export function computeProjectAssignmentDiff(
  originalMembers: ProjectMember[],
  targetMembers: Map<string, ProjectMembershipRole>,
  originalTeams: ProjectTeamMember[],
  targetTeamIds: Set<string>,
): ProjectAssignmentDiff {
  const originalRoleByMembershipId = new Map(
    originalMembers.map((member) => [member.membershipId, member.role]),
  );

  const membersToAdd = [...targetMembers.entries()]
    .filter(([membershipId]) => !originalRoleByMembershipId.has(membershipId))
    .map(([membershipId, role]) => ({ membershipId, role }));

  const membershipIdsToRemove = originalMembers
    .filter((member) => !targetMembers.has(member.membershipId))
    .map((member) => member.membershipId);

  const membersToUpdateRole = originalMembers
    .filter((member) => {
      const targetRole = targetMembers.get(member.membershipId);
      return targetRole !== undefined && targetRole !== member.role;
    })
    .map((member) => ({
      membershipId: member.membershipId,
      role: targetMembers.get(member.membershipId)!,
    }));

  const originalTeamIds = new Set(originalTeams.map((team) => team.teamId));
  const teamIdsToAdd = [...targetTeamIds].filter((teamId) => !originalTeamIds.has(teamId));
  const teamIdsToRemove = originalTeams
    .filter((team) => !targetTeamIds.has(team.teamId))
    .map((team) => team.teamId);

  return {
    membersToAdd,
    membershipIdsToRemove,
    membersToUpdateRole,
    teamIdsToAdd,
    teamIdsToRemove,
  };
}
