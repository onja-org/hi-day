import { bytesToBase64 } from "@/lib/bytesToBase64";
import { dailyTotalsToCsv } from "@/lib/dailyTotalsToCsv";
import { DAILY_TOTALS_FIRST_COLUMN, DAILY_TOTALS_TRAILING_COLUMNS } from "@/lib/dailyTotalsReportConfig";
import { flattenReportRows } from "@/lib/flattenReportRows";
import { toPdfBlob } from "@/lib/toPdfBlob";
import type { DailyTotalsReport } from "@/lib/buildDailyTotalsReport";
import type { SendReportFileType } from "@/types/sendReport";

/** The Daily totals table as a file, base64-encoded for the send endpoint. */
export async function buildDailyTotalsAttachment(
  fileType: SendReportFileType,
  report: DailyTotalsReport,
  title: string,
): Promise<string> {
  if (fileType === "csv") {
    return bytesToBase64(new TextEncoder().encode(dailyTotalsToCsv(report)));
  }
  const columns = [DAILY_TOTALS_FIRST_COLUMN, ...report.columns, ...DAILY_TOTALS_TRAILING_COLUMNS];
  const { header, body } = flattenReportRows(columns, [...report.rows, report.totalRow]);
  const blob = toPdfBlob(title, header, body);
  return bytesToBase64(new Uint8Array(await blob.arrayBuffer()));
}
