import { buildReportTableAttachment, encodeCsvAttachment } from "@/lib/buildReportTableAttachment";
import { buildTimeActivityRows } from "@/lib/buildTimeActivityRows";
import { entriesToCsv } from "@/lib/entriesToCsv";
import { timeActivityColumns } from "@/lib/timeActivityReportConfig";
import type { IdleMember } from "@/types/idleMember";
import type { SendReportFileType } from "@/types/sendReport";
import type { MembershipTeamNames, TimeActivityGrouping } from "@/types/timeActivityGrouping";
import type { TimeEntryListItem } from "@/types/timeEntry";

type AttachmentSource = {
  entries: TimeEntryListItem[];
  grouping: TimeActivityGrouping;
  teamNames: MembershipTeamNames;
  idleMembers: IdleMember[];
  zone: string;
  title: string;
};

/**
 * The report as a file, base64-encoded for the send endpoint. CSV is the
 * same raw entries the Export button downloads; PDF is the table as
 * grouped.
 */
export async function buildTimeActivityAttachment(
  fileType: SendReportFileType,
  { entries, grouping, teamNames, idleMembers, zone, title }: AttachmentSource,
): Promise<string> {
  if (fileType === "csv") return encodeCsvAttachment(entriesToCsv(entries, zone));
  const columns = timeActivityColumns(grouping);
  const rows = buildTimeActivityRows(entries, grouping, { sumDates: false, teamNames, idleMembers });
  return buildReportTableAttachment(fileType, columns, rows, title);
}
