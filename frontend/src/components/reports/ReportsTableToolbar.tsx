import { CaretUpDownIcon, ColumnsIcon } from "@phosphor-icons/react";
import type { ReportTableColumn } from "@/types/reportTable";

type ReportsTableToolbarProps = {
  /** Columns the user may hide — the first (identifying) column isn't one of them. */
  toggleableColumns: ReportTableColumn[];
  hiddenKeys: Set<string>;
  onToggleColumn: (key: string) => void;
  onToggleExpandAll: () => void;
};

export function ReportsTableToolbar({
  toggleableColumns,
  hiddenKeys,
  onToggleColumn,
  onToggleExpandAll,
}: ReportsTableToolbarProps) {
  return (
    <div className="flex justify-end gap-2 p-3">
      <button
        type="button"
        onClick={onToggleExpandAll}
        aria-label="Expand or collapse all rows"
        className="cursor-pointer rounded-md border border-input-border p-2 text-icon hover:bg-primary/10"
      >
        <CaretUpDownIcon size={16} aria-hidden="true" />
      </button>
      <details className="relative">
        <summary
          aria-label="Choose columns"
          className="cursor-pointer list-none rounded-md border border-input-border p-2 text-icon hover:bg-primary/10"
        >
          <ColumnsIcon size={16} aria-hidden="true" />
        </summary>
        <ul className="absolute right-0 z-10 mt-1 flex max-h-72 w-48 flex-col gap-1 overflow-y-auto rounded-md border border-input-border bg-white p-2 shadow-md">
          {toggleableColumns.map((column) => (
            <li key={column.key}>
              <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-900">
                <input
                  type="checkbox"
                  checked={!hiddenKeys.has(column.key)}
                  onChange={() => onToggleColumn(column.key)}
                />
                {column.header}
              </label>
            </li>
          ))}
        </ul>
      </details>
    </div>
  );
}
