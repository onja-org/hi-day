import { membersExportTable } from "@/lib/membersExportTable";
import { toPdfBlob } from "@/lib/toPdfBlob";
import type { ActiveMemberListItem } from "@/types/membership";

/** The Members tab as a PDF, one row per member. */
export function membersToPdf(members: ActiveMemberListItem[], teamNames: Map<string, string>): Blob {
  const { header, rows } = membersExportTable(members, teamNames);
  return toPdfBlob("Members", header, rows);
}
