import { Membership } from '../database/entities/membership.entity';

/**
 * The single lookup for "which team(s) does this manager scope to". Built
 * against today's interim single-team Membership.teamId — isolated here so
 * the future Teams ticket's real multi-team model only has to change this
 * one function, not every call site that needs a manager's scope
 * (see docs/adr/0008).
 */
export function getManagerScopeTeamId(
  callerMembership: Membership,
): string | null {
  return callerMembership.teamId;
}
