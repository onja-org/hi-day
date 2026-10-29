import { flattenReportRows } from "@/lib/flattenReportRows";
import { toPdfBlob } from "@/lib/toPdfBlob";
import type { ReportTableColumn, ReportTableRow } from "@/types/reportTable";

/** A report table as a PDF, for the Export menu. `subtitle` (the date range) sits above the title. */
export function reportTableToPdf(
  columns: ReportTableColumn[],
  rows: ReportTableRow[],
  title: string,
  subtitle?: string,
  /** Sets the last row in bold, for a table that ends in a total. */
  boldLastRow = false,
): Blob {
  const { header, body } = flattenReportRows(columns, rows);
  return toPdfBlob(title, header, body, {}, subtitle, boldLastRow);
}
