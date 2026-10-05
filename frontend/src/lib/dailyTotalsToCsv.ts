import { toCsvString } from "@/lib/toCsvString";
import type { DailyTotalsReport } from "@/lib/buildDailyTotalsReport";
import { DAILY_TOTALS_FIRST_COLUMN, DAILY_TOTALS_TRAILING_COLUMNS } from "@/lib/dailyTotalsReportConfig";

/** The Daily totals table as CSV: project rows, then the daily total row. */
export function dailyTotalsToCsv({ columns, rows, totalRow }: DailyTotalsReport): string {
  const keyed = [DAILY_TOTALS_FIRST_COLUMN, ...columns, ...DAILY_TOTALS_TRAILING_COLUMNS];
  return toCsvString(
    keyed.map((column) => column.header),
    [...rows, totalRow].map((row) => keyed.map((column) => String(row.cells[column.key] ?? "-"))),
  );
}
