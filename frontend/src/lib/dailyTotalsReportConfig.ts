import { PROJECT_WORK_ORDER_LABEL } from "@/lib/reportColumnLabels";
import type { ReportChartSeries } from "@/types/reportChart";
import type { ReportTableColumn } from "@/types/reportTable";

export const DAILY_TOTALS_CHART_SERIES: ReportChartSeries[] = [
  { key: "worked", label: "Worked", color: "var(--color-primary)" },
];

export const DAILY_TOTALS_FIRST_COLUMN: ReportTableColumn = {
  key: "project",
  header: PROJECT_WORK_ORDER_LABEL,
};

// Time off and earned have no data source yet (no leave or pay-rate model),
// so their cells are left empty and render as "-".
export const DAILY_TOTALS_TRAILING_COLUMNS: ReportTableColumn[] = [
  { key: "timeOff", header: "Time Off" },
  { key: "total", header: "Total worked" },
];
