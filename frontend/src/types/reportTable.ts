import type { ReactNode } from "react";

export type ReportTableColumn = {
  key: string;
  header: string;
};

export type ReportTableRow = {
  id: string;
  /** Cell content keyed by `ReportTableColumn.key`; a missing key renders "-". */
  cells: Record<string, ReactNode>;
  /** What the first column sorts by, e.g. a timestamp for a date row. */
  sortKey: string | number;
  /** Rows revealed by the chevron, e.g. each time entry under a day. */
  subRows?: ReportTableRow[];
};

export type SortDirection = "asc" | "desc";
