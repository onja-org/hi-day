import { CaretDownIcon, CaretRightIcon } from "@phosphor-icons/react";
import clsx from "clsx";
import type { ReportTableColumn, ReportTableRow } from "@/types/reportTable";

type ReportsTableRowGroupProps = {
  columns: ReportTableColumn[];
  row: ReportTableRow;
  expanded: boolean;
  onToggle: () => void;
};

type RowProps = {
  columns: ReportTableColumn[];
  row: ReportTableRow;
  isSub: boolean;
  chevron?: React.ReactNode;
};

function Row({ columns, row, isSub, chevron }: RowProps) {
  return (
    <tr className={clsx("border-t border-input-border", isSub && "bg-primary/5")}>
      {columns.map((column, index) => (
        <td key={column.key} className="px-3 py-2.5 text-xs whitespace-nowrap text-slate-900">
          {index === 0 ? (
            <span className={clsx("flex items-center gap-2", isSub && "pl-6")}>
              {chevron}
              {row.cells[column.key] ?? "-"}
            </span>
          ) : (
            (row.cells[column.key] ?? "-")
          )}
        </td>
      ))}
    </tr>
  );
}

/** A row plus, while expanded, its sub-rows. */
export function ReportsTableRowGroup({ columns, row, expanded, onToggle }: ReportsTableRowGroupProps) {
  const hasSubRows = (row.subRows?.length ?? 0) > 0;
  const Chevron = expanded ? CaretDownIcon : CaretRightIcon;

  return (
    <>
      <Row
        columns={columns}
        row={row}
        isSub={false}
        chevron={
          hasSubRows ? (
            <button
              type="button"
              onClick={onToggle}
              aria-expanded={expanded}
              aria-label={expanded ? "Collapse row" : "Expand row"}
              className="cursor-pointer text-icon"
            >
              <Chevron size={12} aria-hidden="true" />
            </button>
          ) : (
            <span aria-hidden="true" className="size-3" />
          )
        }
      />
      {expanded &&
        row.subRows?.map((subRow) => (
          <Row key={subRow.id} columns={columns} row={subRow} isSub />
        ))}
    </>
  );
}
