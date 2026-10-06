"use client";

import type { ReactNode } from "react";
import { MagnifyingGlassIcon } from "@phosphor-icons/react";
import { SelectField } from "@/components/ui/form/SelectField";
import { APPS_URLS_GROUPINGS, appsUrlsColumns } from "@/lib/appsUrlsReportConfig";
import type { AppsUrlsGrouping } from "@/types/appsUrlsReport";
import type { ReportTableRow } from "@/types/reportTable";
import { PercentUsedCell } from "./PercentUsedCell";
import { ReportTableHeading } from "./ReportTableHeading";
import { ReportsTable } from "./ReportsTable";

type AppsUrlsReportBodyProps = {
  rows: ReportTableRow[];
  grouping: AppsUrlsGrouping;
  onGroupingChange: (grouping: AppsUrlsGrouping) => void;
  search: string;
  onSearchChange: (search: string) => void;
  organisationName: string | undefined;
  zone: string;
  /** Export, send and schedule controls, shown on the heading line. */
  actions: ReactNode;
};

export function AppsUrlsReportBody({
  rows,
  grouping,
  onGroupingChange,
  search,
  onSearchChange,
  organisationName,
  zone,
  actions,
}: AppsUrlsReportBodyProps) {
  const columns = appsUrlsColumns(grouping).map((column) =>
    column.key === "percent"
      ? { ...column, renderCell: (row: ReportTableRow) => <PercentUsedCell value={row.cells.percent as string | undefined} /> }
      : column,
  );

  return (
    <>
      <ReportTableHeading organisationName={organisationName} zone={zone} actions={actions} />

      <div className="flex flex-wrap items-end justify-between gap-4">
        <SelectField
          label="Group by"
          value={grouping}
          onChange={(event) => onGroupingChange(event.target.value as AppsUrlsGrouping)}
          className="w-fit"
        >
          {APPS_URLS_GROUPINGS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </SelectField>
        <label className="relative flex items-center">
          <span className="sr-only">Search apps and sites</span>
          <MagnifyingGlassIcon size={16} aria-hidden="true" className="absolute left-3 text-icon" />
          <input
            type="search"
            value={search}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder="Search"
            className="h-11 w-full rounded-full border border-input-border bg-white pr-4 pl-9 text-sm text-slate-900 sm:w-64"
          />
        </label>
      </div>

      {rows.length === 0 ? (
        <p className="rounded-lg border border-input-border bg-white p-6 text-center text-slate-900/70">
          No app or website activity for this date range.
        </p>
      ) : (
        <ReportsTable key={`${grouping}|${search}`} columns={columns} rows={rows} defaultExpanded />
      )}
    </>
  );
}
