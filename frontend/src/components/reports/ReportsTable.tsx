"use client";

import { useState } from "react";
import type { ReactNode } from "react";
import { ArrowDownIcon, ArrowUpIcon } from "@phosphor-icons/react";
import { collectExpandableIds } from "@/lib/collectExpandableIds";
import { paginateRows } from "@/lib/paginateRows";
import { sortReportRows } from "@/lib/sortReportRows";
import type { ReportTableColumn, ReportTableRow, SortDirection } from "@/types/reportTable";
import { ReportsTableFooter } from "./ReportsTableFooter";
import { ReportsTableRowGroup } from "./ReportsTableRowGroup";
import { ReportsTableToolbar } from "./ReportsTableToolbar";

type ReportsTableProps = {
  /** The first column identifies the row (e.g. Date): it's sortable, holds the expand chevron, and can't be hidden. */
  columns: ReportTableColumn[];
  rows: ReportTableRow[];
  /** Extra controls shown in the toolbar, before the built-in buttons. */
  toolbarExtra?: ReactNode;
};

function toggled<T>(set: Set<T>, value: T): Set<T> {
  const next = new Set(set);
  if (!next.delete(value)) next.add(value);
  return next;
}

export function ReportsTable({ columns, rows, toolbarExtra }: ReportsTableProps) {
  const [direction, setDirection] = useState<SortDirection>("asc");
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [hiddenKeys, setHiddenKeys] = useState<Set<string>>(new Set());
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(50);

  const visibleColumns = columns.filter((column) => !hiddenKeys.has(column.key));
  const pageCount = Math.max(1, Math.ceil(rows.length / perPage));
  const currentPage = Math.min(page, pageCount);
  const pageRows = paginateRows(sortReportRows(rows, direction), currentPage, perPage);
  const expandableIds = collectExpandableIds(rows);
  const SortIcon = direction === "asc" ? ArrowUpIcon : ArrowDownIcon;

  function toggleExpandAll() {
    const allExpanded = expandableIds.every((id) => expandedIds.has(id));
    setExpandedIds(allExpanded ? new Set() : new Set(expandableIds));
  }

  return (
    <div className="rounded-lg border border-input-border bg-white">
      <ReportsTableToolbar
        toggleableColumns={columns.slice(1)}
        hiddenKeys={hiddenKeys}
        onToggleColumn={(key) => setHiddenKeys(toggled(hiddenKeys, key))}
        onToggleExpandAll={expandableIds.length > 0 ? toggleExpandAll : undefined}
        leading={toolbarExtra}
      />
      <div className="overflow-x-auto">
        <table className="w-full text-left">
          <thead>
            <tr className="border-t border-input-border">
              {visibleColumns.map((column, index) => (
                <th
                  key={column.key}
                  scope="col"
                  aria-sort={
                    index === 0 ? (direction === "asc" ? "ascending" : "descending") : undefined
                  }
                  className="px-3 py-3 text-xs font-semibold whitespace-nowrap text-primary-dark"
                >
                  {index === 0 ? (
                    <button
                      type="button"
                      onClick={() => setDirection(direction === "asc" ? "desc" : "asc")}
                      className="flex w-full cursor-pointer items-center justify-between gap-4 font-semibold"
                    >
                      {column.header}
                      <SortIcon size={14} aria-hidden="true" />
                    </button>
                  ) : (
                    column.header
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {pageRows.map((row) => (
              <ReportsTableRowGroup
                key={row.id}
                columns={visibleColumns}
                row={row}
                expandedIds={expandedIds}
                onToggle={(id) => setExpandedIds(toggled(expandedIds, id))}
              />
            ))}
          </tbody>
        </table>
      </div>
      <ReportsTableFooter
        totalRows={rows.length}
        perPage={perPage}
        onPerPageChange={(next) => {
          setPerPage(next);
          setPage(1);
        }}
        page={currentPage}
        pageCount={pageCount}
        onPageChange={setPage}
      />
    </div>
  );
}
