"use client";

import type { ReactNode } from "react";
import { SelectField } from "@/components/ui/form/SelectField";
import { ClockIcon } from "@phosphor-icons/react";
import { buildDailyTotalsReport } from "@/lib/buildDailyTotalsReport";
import { totalEntrySeconds } from "@/lib/buildTimeActivityRows";
import { DAILY_TOTALS_CHART_SERIES } from "@/lib/dailyTotalsReportConfig";
import { formatElapsed } from "@/lib/formatElapsed";
import { formatReportDay } from "@/lib/formatReportDay";
import {
  WORK_SESSIONS_GROUPINGS,
  workSessionsColumns,
  type WorkSessionsGrouping,
} from "@/lib/workSessionsReportConfig";
import type { DateRange } from "@/types/dateRange";
import type { ReportTableRow } from "@/types/reportTable";
import type { TimeEntryListItem } from "@/types/timeEntry";
import { ReportsBarChart } from "./ReportsBarChart";
import { ReportsStatCard } from "./ReportsStatCard";
import { ReportsTable } from "./ReportsTable";

type WorkSessionsReportBodyProps = {
  entries: TimeEntryListItem[];
  rows: ReportTableRow[];
  grouping: WorkSessionsGrouping;
  onGroupingChange: (grouping: WorkSessionsGrouping) => void;
  range: DateRange;
  actions: ReactNode;
};

export function WorkSessionsReportBody({ entries, rows, grouping, onGroupingChange, range, actions }: WorkSessionsReportBodyProps) {
  return (
    <>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <ReportsStatCard label="Time" value={formatElapsed(totalEntrySeconds(entries) * 1000)} icon={ClockIcon} />
      </div>

      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold text-primary-dark">Total hours worked per day</h2>
        <ReportsBarChart
          rows={buildDailyTotalsReport(entries, range).days.map(({ dateKey, seconds }) => ({
            label: formatReportDay(dateKey),
            values: { worked: seconds },
          }))}
          series={DAILY_TOTALS_CHART_SERIES}
        />
      </section>

      <div className="flex flex-wrap items-end justify-between gap-3">
        <SelectField
          label="Group by"
          value={grouping}
          onChange={(event) => onGroupingChange(event.target.value as WorkSessionsGrouping)}
          className="w-fit"
        >
          {WORK_SESSIONS_GROUPINGS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </SelectField>
        <div className="flex flex-wrap items-center gap-3">{actions}</div>
      </div>

      <ReportsTable key={grouping} columns={workSessionsColumns(grouping)} rows={rows} defaultExpanded />
    </>
  );
}
