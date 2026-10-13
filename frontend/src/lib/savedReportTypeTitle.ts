import { REPORTS } from "@/lib/reportCatalog";
import type { SavedReportType } from "@/types/savedReport";

/** The catalogue title of the report a saved report was made from. */
export function savedReportTypeTitle(reportType: SavedReportType): string {
  return REPORTS.find((report) => report.id === reportType)?.title ?? reportType;
}
