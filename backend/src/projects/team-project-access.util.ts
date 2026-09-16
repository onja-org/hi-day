import { Repository } from 'typeorm';
import { ProjectTeam } from '../database/entities/project-team.entity';

/**
 * True if `membershipId` reaches `projectId` through a Team assigned to
 * that Project (ProjectTeam) — the team-based alternative to holding a
 * ProjectMembership directly (see CONTEXT.md's Project membership entry).
 * Shared by every guard/service call site that already checks for a direct
 * ProjectMembership, so the two access paths never drift apart.
 */
export async function hasTeamProjectAccess(
  projectTeams: Repository<ProjectTeam>,
  projectId: string,
  membershipId: string,
): Promise<boolean> {
  const match = await projectTeams
    .createQueryBuilder('projectTeam')
    .innerJoin('projectTeam.team', 'team')
    .innerJoin(
      'team.teamMemberships',
      'teamMembership',
      'teamMembership.membershipId = :membershipId',
      { membershipId },
    )
    .where('projectTeam.projectId = :projectId', { projectId })
    .getOne();

  return match !== null;
}
