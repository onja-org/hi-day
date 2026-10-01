import type { ReactNode } from "react";

export type ReportTableColumn = {
  key: string;
  header: string;
  /** Heading this column sits under in the column chooser, e.g. "Time". */
  group?: string;
  /** Draws this column's cell from the whole row instead of its `cells` entry. */
  renderCell?: (row: ReportTableRow) => ReactNode;
};

export type ReportTableRow = {
  id: string;
  /** Cell content keyed by `ReportTableColumn.key`; a missing key renders "-". */
  cells: Record<string, ReactNode>;
  /** What the first column sorts by, e.g. a timestamp for a date row. */
  sortKey: string | number;
  /** Teams this row stands for — a column can draw them as avatars. */
  teams?: string[];
  /** Rows revealed by the chevron, e.g. each time entry under a day. */
  subRows?: ReportTableRow[];
};

export type SortDirection = "asc" | "desc";
