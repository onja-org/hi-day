import { Membership } from '../database/entities/membership.entity';
import { MembershipRole } from '../database/entities/membership-role.enum';

/**
 * The single lookup for "which team(s) does this manager scope to". Reads
 * `Membership.teamMemberships`, which callers must have loaded via
 * `relations: { teamMemberships: true }` — TypeORM won't populate it
 * otherwise.
 */
export function getManagerScopeTeamIds(callerMembership: Membership): string[] {
  return (callerMembership.teamMemberships ?? [])
    .filter((teamMembership) => teamMembership.isManager)
    .map((teamMembership) => teamMembership.teamId);
}

/**
 * Whether this Membership manages anybody. Managing a team is the grant —
 * a `team_memberships` row with `isManager` — and the org `manager` role
 * alone is not one, since a role nobody scoped to a team supervises no
 * one. Needs `teamMemberships` loaded.
 */
export function actsAsManager(membership: Membership): boolean {
  return (
    membership.role !== MembershipRole.ADMIN &&
    getManagerScopeTeamIds(membership).length > 0
  );
}
