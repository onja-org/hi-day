import { membersExportTable } from "@/lib/membersExportTable";
import { toCsvString } from "@/lib/toCsvString";
import type { ActiveMemberListItem } from "@/types/membership";

/** The Members tab as a CSV file, one row per member. */
export function membersToCsv(
  members: ActiveMemberListItem[],
  teamNames: Map<string, string>,
): string {
  const { header, rows } = membersExportTable(members, teamNames);
  return toCsvString(header, rows);
}
