"use client";

import { useState } from "react";
import { useReport } from "@/hooks/useReport";
import { formatElapsed } from "@/lib/formatElapsed";
import type { TimesheetDatePreset } from "@/lib/getTimesheetDateRange";
import { getTimesheetDateRange } from "@/lib/getTimesheetDateRange";
import type { ReportGroupBy } from "@/types/report";
import { ErrorMessage } from "./ErrorMessage";
import { Spinner } from "./Spinner";

type ReportsTableProps = {
  organisationId: string;
};

const DATE_PRESETS: { value: TimesheetDatePreset; label: string }[] = [
  { value: "today", label: "Today" },
  { value: "this_week", label: "This week" },
  { value: "this_month", label: "This month" },
];

// Split out of ReportsPageContent so the RequireRole gate there stops an
// unauthorized viewer before this ever mounts — useReport's query never
// even fires for them, not just its result being hidden.
export function ReportsTable({ organisationId }: ReportsTableProps) {
  const [groupBy, setGroupBy] = useState<ReportGroupBy>("person");
  const [datePreset, setDatePreset] = useState<TimesheetDatePreset>("this_week");

  // Restricted to presets that always resolve to a real range — "all"
  // (the one case `getTimesheetDateRange` returns null for) isn't offered
  // here, since a report with no lower bound would scan every rollup ever
  // written.
  const range = getTimesheetDateRange(datePreset)!;
  const reportQuery = useReport(organisationId, { groupBy, ...range });

  const totalSeconds = (reportQuery.data ?? []).reduce(
    (sum, row) => sum + row.seconds,
    0,
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <div
          role="tablist"
          aria-label="Group by"
          className="flex rounded-md border border-input-border bg-white p-0.5"
        >
          {(["person", "project"] as const).map((value) => (
            <button
              key={value}
              type="button"
              role="tab"
              aria-selected={groupBy === value}
              onClick={() => setGroupBy(value)}
              className={
                groupBy === value
                  ? "rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-white"
                  : "rounded-md px-3 py-1.5 text-sm font-medium text-slate-900 hover:bg-cream"
              }
            >
              By {value === "person" ? "person" : "project"}
            </button>
          ))}
        </div>

        <label className="flex items-center gap-2 text-sm text-slate-900">
          Date range
          <select
            value={datePreset}
            onChange={(event) =>
              setDatePreset(event.target.value as TimesheetDatePreset)
            }
            className="rounded-md border border-input-border bg-white px-2 py-1.5 text-sm text-slate-900"
          >
            {DATE_PRESETS.map((preset) => (
              <option key={preset.value} value={preset.value}>
                {preset.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      {reportQuery.isLoading && (
        <p className="flex items-center gap-2 text-slate-900">
          <Spinner className="text-primary-dark" />
          Loading report…
        </p>
      )}

      {reportQuery.isError && (
        <ErrorMessage
          message={
            reportQuery.error instanceof Error
              ? reportQuery.error.message
              : "Could not load this report."
          }
        />
      )}

      {reportQuery.data && reportQuery.data.length === 0 && (
        <p className="text-slate-900">
          No time tracked yet for this date range.
        </p>
      )}

      {reportQuery.data && reportQuery.data.length > 0 && (
        <div className="overflow-x-auto rounded-md border border-input-border">
          <table className="w-full min-w-[420px] text-left text-sm">
            <thead>
              <tr className="border-b border-input-border text-slate-900">
                <th className="px-3 py-2 font-medium">
                  {groupBy === "person" ? "Person" : "Project"}
                </th>
                <th className="px-3 py-2 text-right font-medium">
                  Time tracked
                </th>
              </tr>
            </thead>
            <tbody>
              {reportQuery.data.map((row) => (
                <tr key={row.key} className="border-b border-input-border last:border-b-0">
                  <td className="px-3 py-2 text-slate-900">{row.label}</td>
                  <td className="px-3 py-2 text-right tabular-nums text-slate-900">
                    {formatElapsed(row.seconds * 1000)}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t border-input-border font-medium text-primary-dark">
                <td className="px-3 py-2">Total</td>
                <td className="px-3 py-2 text-right tabular-nums">
                  {formatElapsed(totalSeconds * 1000)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  );
}
