import { Membership } from '../database/entities/membership.entity';
import { MembershipRole } from '../database/entities/membership-role.enum';
import { getManagerScopeTeamId } from './manager-scope.util';

/**
 * Whether `caller` may view data belonging to `target`: always themselves,
 * admins see everyone, managers see their own team, and peers never see
 * each other.
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
    const scopeTeamId = getManagerScopeTeamId(caller);
    return scopeTeamId !== null && target.teamId === scopeTeamId;
  }

  return false;
}
