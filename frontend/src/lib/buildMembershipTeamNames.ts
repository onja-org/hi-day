import type { ActiveMemberListItem } from "@/types/membership";
import type { OrganisationTeam } from "@/types/team";
import type { MembershipTeamNames } from "@/types/timeActivityGrouping";

/** Which team names each membership belongs to; teams that no longer exist are skipped. */
export function buildMembershipTeamNames(
  members: Pick<ActiveMemberListItem, "id" | "teamIds">[],
  teams: OrganisationTeam[],
): MembershipTeamNames {
  const nameById = new Map(teams.map((team) => [team.id, team.name]));
  return new Map(
    members.map((member) => [
      member.id,
      member.teamIds.flatMap((teamId) => nameById.get(teamId) ?? []),
    ]),
  );
}
