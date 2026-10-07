import { flattenReportRows } from "@/lib/flattenReportRows";
import { toCsvString } from "@/lib/toCsvString";
import type { ReportTableColumn, ReportTableRow } from "@/types/reportTable";

/** A report table as CSV, nested rows directly beneath their parent. */
export function reportTableToCsv(columns: ReportTableColumn[], rows: ReportTableRow[]): string {
  const { header, body } = flattenReportRows(columns, rows);
  return toCsvString(header, body);
}
