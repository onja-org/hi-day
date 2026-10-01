import type { ReportTableColumn } from "@/types/reportTable";

type ColumnGroup = { group: string | undefined; columns: ReportTableColumn[] };

/** Buckets columns by their `group`, keeping the order each group (and column) first appears in. */
export function groupColumns(columns: ReportTableColumn[]): ColumnGroup[] {
  const groups: ColumnGroup[] = [];
  for (const column of columns) {
    const existing = groups.find((candidate) => candidate.group === column.group);
    if (existing) existing.columns.push(column);
    else groups.push({ group: column.group, columns: [column] });
  }
  return groups;
}
