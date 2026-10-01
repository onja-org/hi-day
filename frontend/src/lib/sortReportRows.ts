import type { ReportTableRow, SortDirection } from "@/types/reportTable";

/** A sorted copy of `rows` by `sortKey` — numbers numerically, strings alphabetically. */
export function sortReportRows(rows: ReportTableRow[], direction: SortDirection): ReportTableRow[] {
  const sign = direction === "asc" ? 1 : -1;
  return [...rows].sort((a, b) => {
    if (typeof a.sortKey === "number" && typeof b.sortKey === "number") {
      return (a.sortKey - b.sortKey) * sign;
    }
    return String(a.sortKey).localeCompare(String(b.sortKey)) * sign;
  });
}
