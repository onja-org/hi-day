import { Membership } from '../database/entities/membership.entity';
import { MembershipRole } from '../database/entities/membership-role.enum';
import { actsAsManager, getManagerScopeTeamIds } from './manager-scope.util';

/**
 * Whether `caller` may view data belonging to `target`: always themselves,
 * an admin everyone, and whoever manages a team its ordinary members. The
 * manager test is per-team, so running one team doesn't hide you on
 * another where you're simply a member. Both need `teamMemberships` loaded.
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

  // Before team scope, so joining a team never makes an admin watchable.
  if (target.role === MembershipRole.ADMIN) {
    return false;
  }

  const scopeTeamIds = getManagerScopeTeamIds(caller);
  const shared = (target.teamMemberships ?? []).filter((teamMembership) =>
    scopeTeamIds.includes(teamMembership.teamId),
  );

  // Co-managers are hidden from each other only where running a team
  // together is the whole of their overlap.
  return shared.some((teamMembership) => !teamMembership.isManager);
}
