import type { ApiResult } from "./api";
import type { MembershipRole } from "./membership";

export type OrganisationTeam = {
  id: string;
  name: string;
};

/** A Teams-page row — see the backend's TeamOverview. Also what the teams
 * list endpoint returns everywhere else (e.g. team pickers), which just
 * ignore the extra fields. */
export type TeamOverview = OrganisationTeam & {
  members: TeamMember[];
  projectCount: number;
};

export type GetOrganisationTeamsResult =
  | { ok: true; teams: TeamOverview[] }
  | { ok: false; message: string };

export type TeamMember = {
  membershipId: string;
  userId: string;
  name: string | null;
  email: string;
  isManager: boolean;
  /** Their org role — an admin's row is read-only to a team manager. */
  role: MembershipRole;
  /** Per-member override of "Members can see their own activity"; `null`
   * inherits the org default. Settable here by a team manager. */
  canViewOwnActivity: boolean | null;
};

export type TeamDetail = {
  id: string;
  name: string;
  members: TeamMember[];
};

export type GetTeamDetailResult =
  | { ok: true; team: TeamDetail }
  | { ok: false; message: string };

export type CreateTeamResult = ApiResult<{ team: OrganisationTeam }>;

export type UpdateTeamResult = CreateTeamResult;

export type TeamActionResult = ApiResult;

/** How many members the bulk change applied to — admins and team managers
 * are excluded server-side, since the setting does nothing for them. */
export type SetTeamActivityVisibilityResult = ApiResult<{ updated: number }>;

export type AddTeamMemberInput = {
  membershipId: string;
  isManager?: boolean;
};
