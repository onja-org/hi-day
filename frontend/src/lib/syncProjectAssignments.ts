import { addProjectMembers } from "./addProjectMembers";
import { addProjectTeam } from "./addProjectTeam";
import { computeProjectAssignmentDiff } from "./computeProjectAssignmentDiff";
import { removeProjectMember } from "./removeProjectMember";
import { removeProjectTeam } from "./removeProjectTeam";
import { updateProjectMember } from "./updateProjectMember";
import type {
  ProjectMember,
  ProjectMembershipRole,
  ProjectTeamMember,
} from "@/types/project";

export type SyncProjectAssignmentsResult = {
  ok: boolean;
  /** Human-readable, one per failed add/remove/role-change request. */
  failures: string[];
};

/**
 * Applies the edit form's member/team selections to an existing project —
 * the `PATCH` project endpoint only accepts name/description/colour, so
 * assignment changes go through the same per-member/per-team endpoints the
 * dedicated "Add members"/"Add team" modals use, one request per change.
 */
export async function syncProjectAssignments(
  organisationId: string,
  projectId: string,
  originalMembers: ProjectMember[],
  targetMembers: Map<string, ProjectMembershipRole>,
  originalTeams: ProjectTeamMember[],
  targetTeamIds: Set<string>,
): Promise<SyncProjectAssignmentsResult> {
  const diff = computeProjectAssignmentDiff(
    originalMembers,
    targetMembers,
    originalTeams,
    targetTeamIds,
  );
  const failures: string[] = [];

  if (diff.membersToAdd.length > 0) {
    const result = await addProjectMembers(organisationId, projectId, diff.membersToAdd);
    for (const failure of result.failed) {
      failures.push(`Couldn't add member: ${failure.message}`);
    }
  }

  const removeResults = await Promise.all(
    diff.membershipIdsToRemove.map((membershipId) =>
      removeProjectMember(organisationId, projectId, membershipId),
    ),
  );
  for (const result of removeResults) {
    if (!result.ok) failures.push(`Couldn't remove member: ${result.message}`);
  }

  const roleResults = await Promise.all(
    diff.membersToUpdateRole.map(({ membershipId, role }) =>
      updateProjectMember(organisationId, projectId, membershipId, { role }),
    ),
  );
  for (const result of roleResults) {
    if (!result.ok) failures.push(`Couldn't update member role: ${result.message}`);
  }

  const teamAddResults = await Promise.all(
    diff.teamIdsToAdd.map((teamId) => addProjectTeam(organisationId, projectId, { teamId })),
  );
  for (const result of teamAddResults) {
    if (!result.ok) failures.push(`Couldn't add team: ${result.message}`);
  }

  const teamRemoveResults = await Promise.all(
    diff.teamIdsToRemove.map((teamId) => removeProjectTeam(organisationId, projectId, teamId)),
  );
  for (const result of teamRemoveResults) {
    if (!result.ok) failures.push(`Couldn't remove team: ${result.message}`);
  }

  return { ok: failures.length === 0, failures };
}
