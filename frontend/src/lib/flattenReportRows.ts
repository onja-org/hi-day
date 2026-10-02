import type { ReportTableColumn, ReportTableRow } from "@/types/reportTable";

function cellText(column: ReportTableColumn, row: ReportTableRow): string {
  if (column.key === "team" && row.teams) return row.teams.join(", ") || "-";
  const cell = row.cells[column.key];
  return typeof cell === "string" || typeof cell === "number" ? String(cell) : "-";
}

/**
 * A report table as plain text for a PDF: a header row and one line per
 * row, nested rows directly beneath their parent and indented in the first
 * column. Only text and number cells survive; anything drawn from JSX
 * becomes "-" (the team column is read from `teams` instead).
 */
export function flattenReportRows(
  columns: ReportTableColumn[],
  rows: ReportTableRow[],
): { header: string[]; body: string[][] } {
  const body: string[][] = [];
  const walk = (list: ReportTableRow[], depth: number) => {
    for (const row of list) {
      body.push(
        columns.map((column, index) =>
          index === 0 ? `${"    ".repeat(depth)}${cellText(column, row)}` : cellText(column, row),
        ),
      );
      walk(row.subRows ?? [], depth + 1);
    }
  };
  walk(rows, 0);
  return { header: columns.map((column) => column.header), body };
}
