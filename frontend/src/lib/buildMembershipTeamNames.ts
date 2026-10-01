import type { TeamOverview } from "@/types/team";
import type { MembershipTeamNames } from "@/types/timeActivityGrouping";

type TeamRoster = Pick<TeamOverview, "id" | "name" | "members">;

/**
 * Which team names each membership belongs to, read off the teams' rosters.
 * The teams list is already limited to what the viewer may see (an admin
 * gets every team, anyone else only their own), so this works for a plain
 * member too — unlike the members list, which they can't fetch.
 */
export function buildMembershipTeamNames(teams: TeamRoster[]): MembershipTeamNames {
  const names: MembershipTeamNames = new Map();
  for (const team of teams) {
    for (const { membershipId } of team.members) {
      names.set(membershipId, [...(names.get(membershipId) ?? []), team.name]);
    }
  }
  return names;
}

/** The same mapping by team id — what the Teams filter matches on. */
export function buildMembershipTeamIds(teams: TeamRoster[]): Map<string, string[]> {
  const ids = new Map<string, string[]>();
  for (const team of teams) {
    for (const { membershipId } of team.members) {
      ids.set(membershipId, [...(ids.get(membershipId) ?? []), team.id]);
    }
  }
  return ids;
}
