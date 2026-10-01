import type { ReportTableRow } from "@/types/reportTable";

/** Ids of every row, at any depth, that has sub-rows to reveal. */
export function collectExpandableIds(rows: ReportTableRow[]): string[] {
  return rows.flatMap((row) =>
    row.subRows?.length ? [row.id, ...collectExpandableIds(row.subRows)] : [],
  );
}
