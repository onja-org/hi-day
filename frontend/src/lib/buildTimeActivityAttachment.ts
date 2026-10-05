import { buildTimeActivityRows } from "@/lib/buildTimeActivityRows";
import { bytesToBase64 } from "@/lib/bytesToBase64";
import { entriesToCsv } from "@/lib/entriesToCsv";
import { flattenReportRows } from "@/lib/flattenReportRows";
import { timeActivityColumns } from "@/lib/timeActivityReportConfig";
import { toPdfBlob } from "@/lib/toPdfBlob";
import type { SendReportFileType } from "@/types/sendReport";
import type { MembershipTeamNames, TimeActivityGrouping } from "@/types/timeActivityGrouping";
import type { TimeEntryListItem } from "@/types/timeEntry";

type AttachmentSource = {
  entries: TimeEntryListItem[];
  grouping: TimeActivityGrouping;
  teamNames: MembershipTeamNames;
  idleMembers: { id: string; label: string }[];
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
  if (fileType === "csv") {
    return bytesToBase64(new TextEncoder().encode(entriesToCsv(entries, zone)));
  }
  const columns = timeActivityColumns(grouping);
  const rows = buildTimeActivityRows(entries, grouping, { sumDates: false, teamNames, idleMembers });
  const { header, body } = flattenReportRows(columns, rows);
  const blob = toPdfBlob(title, header, body);
  return bytesToBase64(new Uint8Array(await blob.arrayBuffer()));
}
