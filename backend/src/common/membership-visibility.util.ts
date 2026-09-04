import { Membership } from '../database/entities/membership.entity';
import { MembershipRole } from '../database/entities/membership-role.enum';
import { getManagerScopeTeamIds } from './manager-scope.util';

/**
 * Whether `caller` may view data belonging to `target`: always themselves,
 * admins see everyone, managers see anyone sharing one of their managed
 * teams, and peers never see each other. Requires both `caller` and
 * `target` to have `teamMemberships` loaded.
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
