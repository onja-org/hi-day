import { formatMembershipRole } from "@/lib/formatMembershipRole";
import type { ActiveMemberListItem } from "@/types/membership";

const HEADER = ["Name", "Email", "Role", "Status", "Projects", "Teams", "Date added"];

/** The Members tab as a header and one row per member, for the CSV and PDF exports. `teamNames` maps team
 * id → name; teams the exporter can't see are left out of the Teams cell. */
export function membersExportTable(
  members: ActiveMemberListItem[],
  teamNames: Map<string, string>,
): { header: string[]; rows: string[][] } {
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
  return { header: HEADER, rows };
}
