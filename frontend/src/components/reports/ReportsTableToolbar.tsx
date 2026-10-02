import type { ReactNode } from "react";
import { CaretUpDownIcon, ColumnsIcon } from "@phosphor-icons/react";
import { groupColumns } from "@/lib/groupColumns";
import type { ReportTableColumn } from "@/types/reportTable";

type ReportsTableToolbarProps = {
  /** Columns the user may hide — the first (identifying) column isn't one of them. */
  toggleableColumns: ReportTableColumn[];
  hiddenKeys: Set<string>;
  onToggleColumn: (key: string) => void;
  /** Omit when no row has anything to expand — the button is hidden. */
  onToggleExpandAll?: () => void;
  /** Extra controls placed before the built-in buttons. */
  leading?: ReactNode;
};

export function ReportsTableToolbar({
  toggleableColumns,
  hiddenKeys,
  onToggleColumn,
  onToggleExpandAll,
  leading,
}: ReportsTableToolbarProps) {
  const groups = groupColumns(toggleableColumns);

  return (
    <div className="flex items-center justify-end gap-2 p-3">
      {leading}
      {onToggleExpandAll && (
        <button
          type="button"
          onClick={onToggleExpandAll}
          aria-label="Expand or collapse all rows"
          className="cursor-pointer rounded-md border border-input-border p-2 text-icon hover:bg-primary/10"
        >
          <CaretUpDownIcon size={16} aria-hidden="true" />
        </button>
      )}
      <details className="relative">
        <summary
          aria-label="Choose columns"
          className="cursor-pointer list-none rounded-md border border-input-border p-2 text-icon hover:bg-primary/10"
        >
          <ColumnsIcon size={16} aria-hidden="true" />
        </summary>
        <div className="absolute right-0 z-10 mt-1 flex max-h-72 w-52 flex-col gap-2 overflow-y-auto rounded-md border border-input-border bg-white p-2 shadow-md">
          {groups.map(({ group, columns }) => (
            <fieldset key={group ?? "ungrouped"} className="flex flex-col gap-1">
              {group && (
                <legend className="text-xs font-semibold text-primary-dark">{group}</legend>
              )}
              {columns.map((column) => (
                <label
                  key={column.key}
                  className="flex cursor-pointer items-center gap-2 text-sm text-slate-900"
                >
                  <input
                    type="checkbox"
                    checked={!hiddenKeys.has(column.key)}
                    onChange={() => onToggleColumn(column.key)}
                  />
                  {column.header}
                </label>
              ))}
            </fieldset>
          ))}
        </div>
      </details>
    </div>
  );
}
