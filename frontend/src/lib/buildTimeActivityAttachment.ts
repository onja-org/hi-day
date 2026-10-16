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
  /** Off, the file has no project column or grouping. */
  projectsEnabled?: boolean;
};

/**
 * The report as a file, base64-encoded for the send endpoint. CSV is the
 * same raw entries the Export button downloads; PDF is the table as
 * grouped.
 */
export async function buildTimeActivityAttachment(
  fileType: SendReportFileType,
  { entries, grouping, teamNames, idleMembers, zone, title, weekStart, projectsEnabled = true }: AttachmentSource,
): Promise<string> {
  if (fileType === "csv") return encodeCsvAttachment(entriesToCsv(entries, zone, projectsEnabled));
  const columns = timeActivityColumns(grouping, projectsEnabled);
  const rows = buildTimeActivityRows(entries, grouping, {
    sumDates: false,
    teamNames,
    idleMembers,
    weekStart,
  });
  return buildReportTableAttachment(fileType, columns, rows, title);
}
