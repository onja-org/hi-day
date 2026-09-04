import { Membership } from '../database/entities/membership.entity';

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
