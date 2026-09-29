import type { ApiResult } from "./api";

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

export type AddTeamMemberInput = {
  membershipId: string;
  isManager?: boolean;
};
