import { formatMembershipRole } from "@/lib/formatMembershipRole";
import { toCsvString } from "@/lib/toCsvString";
import type { ActiveMemberListItem } from "@/types/membership";

const HEADER = ["Name", "Email", "Role", "Status", "Projects", "Teams", "Date added"];

/** The Members tab as a CSV file, one row per member. `teamNames` maps team
 * id → name; teams the exporter can't see are left out of the Teams cell. */
export function membersToCsv(
  members: ActiveMemberListItem[],
  teamNames: Map<string, string>,
): string {
  const rows = members.map((member) => [
    member.name ?? "",
    member.email,
    formatMembershipRole(member.role),
    member.status === "active" ? "Active" : "Removed",
    String(member.projectIds.length),
    member.teamIds
      .map((teamId) => teamNames.get(teamId))
      .filter((name): name is string => Boolean(name))
      .join("; "),
    new Date(member.joinedAt).toISOString().slice(0, 10),
  ]);

  return toCsvString(HEADER, rows);
}
