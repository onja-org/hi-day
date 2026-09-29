import { addProjectMember } from "./addProjectMember";
import { addProjectTeam } from "./addProjectTeam";
import { updateProject } from "./updateProject";
import type { ProjectBatchEdit, ProjectOverviewItem } from "@/types/project";

/**
 * Applies a batch edit to one project through the existing per-project
 * endpoints: sets the colour, then adds whichever of the chosen teams and
 * members it doesn't already have. Anything already in place is skipped
 * rather than sent, so it never comes back as an "already on the project"
 * error.
 */
export async function applyProjectBatchEdit(
  organisationId: string,
  project: ProjectOverviewItem,
  edit: ProjectBatchEdit,
): Promise<{ ok: boolean; message: string }> {
  const failures: string[] = [];
  let changes = 0;

  if (edit.colour && edit.colour !== project.colour) {
    const result = await updateProject(organisationId, project.id, { colour: edit.colour });
    if (result.ok) changes += 1;
    else failures.push(result.message);
  }

  const assignedTeamIds = new Set(project.teams.map((team) => team.teamId));
  for (const teamId of edit.teamIds.filter((id) => !assignedTeamIds.has(id))) {
    const result = await addProjectTeam(organisationId, project.id, { teamId });
    if (result.ok) changes += 1;
    else failures.push(result.message);
  }

  const assignedMemberIds = new Set(project.members.map((member) => member.membershipId));
  for (const membershipId of edit.memberIds.filter((id) => !assignedMemberIds.has(id))) {
    const result = await addProjectMember(organisationId, project.id, {
      membershipId,
      role: edit.memberRole,
    });
    if (result.ok) changes += 1;
    else failures.push(result.message);
  }

  if (failures.length > 0) return { ok: false, message: failures[0] };
  return { ok: true, message: changes > 0 ? "Updated" : "Already up to date" };
}
