import { buildReportTableAttachment, encodeCsvAttachment } from "@/lib/buildReportTableAttachment";
import { buildTimeActivityRows } from "@/lib/buildTimeActivityRows";
import { entriesToCsv } from "@/lib/entriesToCsv";
import { timeActivityColumns } from "@/lib/timeActivityReportConfig";
import type { IdleMember } from "@/types/idleMember";
import type { WeekStart } from "@/types/organisation";
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
  /** So an exported file groups weeks as the screen does. */
  weekStart: WeekStart;
};

/**
 * The report as a file, base64-encoded for the send endpoint. CSV is the
 * same raw entries the Export button downloads; PDF is the table as
 * grouped.
 */
export async function buildTimeActivityAttachment(
  fileType: SendReportFileType,
  { entries, grouping, teamNames, idleMembers, zone, title, weekStart }: AttachmentSource,
): Promise<string> {
  if (fileType === "csv") return encodeCsvAttachment(entriesToCsv(entries, zone));
  const columns = timeActivityColumns(grouping);
  const rows = buildTimeActivityRows(entries, grouping, {
    sumDates: false,
    teamNames,
    idleMembers,
    weekStart,
  });
  return buildReportTableAttachment(fileType, columns, rows, title);
}
