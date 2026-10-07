import { DAILY_TOTALS_FIRST_COLUMN, DAILY_TOTALS_TRAILING_COLUMNS } from "@/lib/dailyTotalsReportConfig";
import type { DailyTotalsReport } from "@/lib/buildDailyTotalsReport";
import type { ReportTableColumn, ReportTableRow } from "@/types/reportTable";

/** The Daily totals table as columns and rows: project rows, then the daily total row. */
export function dailyTotalsTable({ columns, rows, totalRow }: DailyTotalsReport): {
  columns: ReportTableColumn[];
  rows: ReportTableRow[];
} {
  return {
    columns: [DAILY_TOTALS_FIRST_COLUMN, ...columns, ...DAILY_TOTALS_TRAILING_COLUMNS],
    rows: [...rows, totalRow],
  };
}
