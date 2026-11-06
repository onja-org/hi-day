import { SetMetadata } from '@nestjs/common';

export const ALLOW_TEAM_MANAGERS_KEY = 'allowTeamManagers';

/**
 * Opens a route gated on the `manager` role to whoever manages a team,
 * whatever their org role (see `actsAsManager`). Opt-in per route rather
 * than applied to every manager route: supervising a team says nothing
 * about creating Projects or editing anybody's Membership, and those are
 * gated on the same role.
 */
export const AllowTeamManagers = () =>
  SetMetadata(ALLOW_TEAM_MANAGERS_KEY, true);
