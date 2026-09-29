import { addProjectMember } from "./addProjectMember";
import { addTeamMember } from "./addTeamMember";
import { diffIdSets } from "./diffIdSets";
import { removeProjectMember } from "./removeProjectMember";
import { removeTeamMember } from "./removeTeamMember";

type AssignmentSelection = {
  original: string[];
  target: string[];
};

/**
 * Applies a member's edited team and project selections, one add/remove
 * request per change through the same endpoints the team and project pages
 * use (added as a plain team/project member). Each failure is reported by
 * name so the modal can say exactly which change didn't stick.
 */
export async function syncMemberAssignments(
  organisationId: string,
  membershipId: string,
  teams: AssignmentSelection,
  projects: AssignmentSelection,
  nameOf: (id: string) => string,
): Promise<{ failures: string[] }> {
  const teamDiff = diffIdSets(teams.original, teams.target);
  const projectDiff = diffIdSets(projects.original, projects.target);

  const requests = [
    ...teamDiff.toAdd.map((teamId) => ({
      label: `add to ${nameOf(teamId)}`,
      run: () => addTeamMember(organisationId, teamId, { membershipId }),
    })),
    ...teamDiff.toRemove.map((teamId) => ({
      label: `remove from ${nameOf(teamId)}`,
      run: () => removeTeamMember(organisationId, teamId, membershipId),
    })),
    ...projectDiff.toAdd.map((projectId) => ({
      label: `add to ${nameOf(projectId)}`,
      run: () => addProjectMember(organisationId, projectId, { membershipId, role: "member" }),
    })),
    ...projectDiff.toRemove.map((projectId) => ({
      label: `remove from ${nameOf(projectId)}`,
      run: () => removeProjectMember(organisationId, projectId, membershipId),
    })),
  ];

  const results = await Promise.all(requests.map((request) => request.run()));
  const failures = results.flatMap((result, index) =>
    result.ok ? [] : [`Couldn't ${requests[index].label}: ${result.message}`],
  );

  return { failures };
}
