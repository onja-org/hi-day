import { buildDailyTotals } from "@/lib/buildDailyTotals";
import { formatElapsed } from "@/lib/formatElapsed";
import { formatReportDay } from "@/lib/formatReportDay";
import type { ReportTableColumn, ReportTableRow } from "@/types/reportTable";
import type { DateRange } from "@/types/dateRange";
import type { TimeEntryListItem } from "@/types/timeEntry";

export type DailyTotalsReport = {
  /** One column per day of the range, between "Project / Work order" and the totals. */
  columns: ReportTableColumn[];
  /** One row per project worked on. */
  rows: ReportTableRow[];
  /** The "Daily total" row: each day's seconds summed across projects. */
  totalRow: ReportTableRow;
  /** Seconds per day across all projects, oldest first. */
  days: { dateKey: string; seconds: number }[];
};

function hours(seconds: number): string {
  return seconds > 0 ? formatElapsed(seconds * 1000) : "-";
}

function cellsFor(days: { dateKey: string; seconds: number }[], total: number): Record<string, string> {
  const cells: Record<string, string> = { total: hours(total) };
  for (const { dateKey, seconds } of days) cells[dateKey] = hours(seconds);
  return cells;
}

/** The Daily totals table: a project per row and a day per column, plus a total row. */
export function buildDailyTotalsReport(
  entries: TimeEntryListItem[],
  range: DateRange,
  /** The zone the range's days are cut in — the report's own. */
  zone?: string,
): DailyTotalsReport {
  const days = buildDailyTotals(entries, range.from, range.to, null, zone);

  const projects = new Map<string, TimeEntryListItem[]>();
  for (const entry of entries) {
    projects.set(entry.projectId, [...(projects.get(entry.projectId) ?? []), entry]);
  }

  const rows: ReportTableRow[] = [...projects.entries()]
    .map(([projectId, projectEntries]) => {
      const projectDays = buildDailyTotals(projectEntries, range.from, range.to, null, zone);
      const total = projectDays.reduce((sum, day) => sum + day.seconds, 0);
      return {
        total,
        row: {
          id: projectId,
          sortKey: projectEntries[0].projectName,
          cells: { project: projectEntries[0].projectName, ...cellsFor(projectDays, total) },
        },
      };
    })
    .filter(({ total }) => total > 0)
    .map(({ row }) => row);

  const grandTotal = days.reduce((sum, day) => sum + day.seconds, 0);

  return {
    columns: days.map(({ dateKey }) => ({ key: dateKey, header: formatReportDay(dateKey) })),
    rows,
    totalRow: { id: "daily-total", sortKey: "", cells: { project: "Daily total", ...cellsFor(days, grandTotal) } },
    days,
  };
}
