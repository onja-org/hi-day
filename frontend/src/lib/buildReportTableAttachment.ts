import { bytesToBase64 } from "@/lib/bytesToBase64";
import { flattenReportRows } from "@/lib/flattenReportRows";
import { reportTableToCsv } from "@/lib/reportTableToCsv";
import { toPdfBlob } from "@/lib/toPdfBlob";
import type { ReportTableColumn, ReportTableRow } from "@/types/reportTable";
import type { SendReportFileType } from "@/types/sendReport";

/** CSV text as a file, base64-encoded for the send endpoint. */
export function encodeCsvAttachment(csv: string): string {
  return bytesToBase64(new TextEncoder().encode(csv));
}

/** A report table as a file, base64-encoded for the send endpoint. */
export async function buildReportTableAttachment(
  fileType: SendReportFileType,
  columns: ReportTableColumn[],
  rows: ReportTableRow[],
  title: string,
): Promise<string> {
  if (fileType === "csv") return encodeCsvAttachment(reportTableToCsv(columns, rows));
  const { header, body } = flattenReportRows(columns, rows);
  const blob = toPdfBlob(title, header, body);
  return bytesToBase64(new Uint8Array(await blob.arrayBuffer()));
}
