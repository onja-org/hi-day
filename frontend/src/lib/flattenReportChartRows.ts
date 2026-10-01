import type { ReportChartRow, ReportChartSeries } from "@/types/reportChart";

/** Recharts wants one flat object per x-axis slot, with every series present as a number. */
export function flattenReportChartRows(
  rows: ReportChartRow[],
  series: ReportChartSeries[],
): Record<string, string | number>[] {
  return rows.map((row) => {
    const flat: Record<string, string | number> = { label: row.label };
    for (const { key } of series) {
      flat[key] = row.values[key] ?? 0;
    }
    return flat;
  });
}
