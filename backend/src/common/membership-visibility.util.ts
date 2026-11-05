import { Membership } from '../database/entities/membership.entity';
import { MembershipRole } from '../database/entities/membership-role.enum';
import { actsAsManager, getManagerScopeTeamIds } from './manager-scope.util';

/**
 * Whether `caller` may view data belonging to `target`: always themselves,
 * an admin everyone, and whoever manages a team the plain members of that
 * team — never another manager or an admin. Managing a team is the grant,
 * not the org `manager` role (see `actsAsManager`). Both need
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

  if (!actsAsManager(caller)) {
    return false;
  }

  // Only plain members are visible: an admin or anyone *labelled* manager
  // stays hidden even where they manage nothing, so the answer never
  // contradicts the role shown beside their name.
  if (target.role !== MembershipRole.MEMBER || actsAsManager(target)) {
    return false;
  }

  const scopeTeamIds = getManagerScopeTeamIds(caller);
  const targetTeamIds = (target.teamMemberships ?? []).map(
    (teamMembership) => teamMembership.teamId,
  );
  return targetTeamIds.some((teamId) => scopeTeamIds.includes(teamId));
}
