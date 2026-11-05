import { Membership } from '../database/entities/membership.entity';
import { MembershipRole } from '../database/entities/membership-role.enum';
import { getManagerScopeTeamIds } from './manager-scope.util';

/**
 * Whether `caller` may view data belonging to `target`: always themselves,
 * an admin everyone, a manager the *members* of the teams they manage —
 * never a peer manager or an admin, team or no team. Both need
 * `teamMemberships` loaded.
 */
export function canViewMembership(
  caller: Membership,
  target: Membership,
): boolean {
  if (caller.id === target.id) {
    return true;
  }

  if (caller.role === MembershipRole.ADMIN) {
    return true;
  }

  if (caller.role === MembershipRole.MANAGER) {
    if (target.role !== MembershipRole.MEMBER) {
      return false;
    }

    const scopeTeamIds = getManagerScopeTeamIds(caller);
    if (scopeTeamIds.length === 0) {
      return false;
    }

    const targetTeamIds = (target.teamMemberships ?? []).map(
      (teamMembership) => teamMembership.teamId,
    );
    return targetTeamIds.some((teamId) => scopeTeamIds.includes(teamId));
  }

  return false;
}
