import { CaretDownIcon, CaretRightIcon } from "@phosphor-icons/react";
import clsx from "clsx";
import type { ReportTableColumn, ReportTableRow } from "@/types/reportTable";

type ReportsTableRowGroupProps = {
  columns: ReportTableColumn[];
  row: ReportTableRow;
  /** 0 for a top-level row; each level of sub-row nests one deeper. */
  depth?: number;
  expandedIds: Set<string>;
  onToggle: (id: string) => void;
};

function cellContent(column: ReportTableColumn, row: ReportTableRow) {
  return column.renderCell ? column.renderCell(row) : (row.cells[column.key] ?? "-");
}

// Literal classes (not built from `depth`) so Tailwind's scanner finds them.
const INDENT = ["", "pl-6", "pl-12", "pl-18"];

/** A row, plus — while expanded — its sub-rows, recursively. */
export function ReportsTableRowGroup({
  columns,
  row,
  depth = 0,
  expandedIds,
  onToggle,
}: ReportsTableRowGroupProps) {
  const hasSubRows = (row.subRows?.length ?? 0) > 0;
  const expanded = expandedIds.has(row.id);
  const Chevron = expanded ? CaretDownIcon : CaretRightIcon;

  return (
    <>
      <tr className={clsx("border-t border-input-border", depth > 0 && "bg-primary/5")}>
        {columns.map((column, index) => (
          <td key={column.key} className="px-3 py-2.5 text-xs whitespace-nowrap text-slate-900">
            {index === 0 ? (
              <span className={clsx("flex items-center gap-2", INDENT[Math.min(depth, INDENT.length - 1)])}>
                {hasSubRows ? (
                  <button
                    type="button"
                    onClick={() => onToggle(row.id)}
                    aria-expanded={expanded}
                    aria-label={expanded ? "Collapse row" : "Expand row"}
                    className="cursor-pointer text-icon"
                  >
                    <Chevron size={12} aria-hidden="true" />
                  </button>
                ) : (
                  <span aria-hidden="true" className="size-3" />
                )}
                {cellContent(column, row)}
              </span>
            ) : (
              cellContent(column, row)
            )}
          </td>
        ))}
      </tr>
      {expanded &&
        row.subRows?.map((subRow) => (
          <ReportsTableRowGroup
            key={subRow.id}
            columns={columns}
            row={subRow}
            depth={depth + 1}
            expandedIds={expandedIds}
            onToggle={onToggle}
          />
        ))}
    </>
  );
}
