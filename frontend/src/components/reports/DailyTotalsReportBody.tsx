"use client";

import type { ReactNode } from "react";
import { ClockIcon, FolderSimpleIcon } from "@phosphor-icons/react";
import {
  DAILY_TOTALS_CHART_SERIES,
  DAILY_TOTALS_FIRST_COLUMN,
  DAILY_TOTALS_TRAILING_COLUMNS,
} from "@/lib/dailyTotalsReportConfig";
import { formatElapsed } from "@/lib/formatElapsed";
import { formatReportDay } from "@/lib/formatReportDay";
import { timezoneLabel } from "@/lib/timezone";
import type { DailyTotalsReport } from "@/lib/buildDailyTotalsReport";
import { ReportsBarChart } from "./ReportsBarChart";
import { ReportsStatCard } from "./ReportsStatCard";
import { ReportsTable } from "./ReportsTable";

type DailyTotalsReportBodyProps = {
  report: DailyTotalsReport;
  organisationName: string | undefined;
  /** The zone the days are read in. */
  zone: string;
  /** Export, send and schedule controls, shown on the table's heading line. */
  actions: ReactNode;
};

export function DailyTotalsReportBody({ report, organisationName, zone, actions }: DailyTotalsReportBodyProps) {
  const totalSeconds = report.days.reduce((sum, day) => sum + day.seconds, 0);
  const averageSeconds = report.days.length > 0 ? totalSeconds / report.days.length : 0;

  return (
    <>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <ReportsStatCard label="Projects worked" value={String(report.rows.length)} icon={FolderSimpleIcon} />
        <ReportsStatCard label="Avg. hours per day" value={formatElapsed(averageSeconds * 1000)} icon={ClockIcon} />
      </div>

      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold text-primary-dark">Total hours worked per day</h2>
        <ReportsBarChart
          rows={report.days.map(({ dateKey, seconds }) => ({
            label: formatReportDay(dateKey),
            values: { worked: seconds },
          }))}
          series={DAILY_TOTALS_CHART_SERIES}
        />
      </section>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="flex items-baseline gap-3">
          <span className="text-xl text-primary-dark">{organisationName}</span>
          <span className="text-xs text-slate-900/70">{timezoneLabel(zone)}</span>
        </h2>
        <div className="flex flex-wrap items-center gap-3">{actions}</div>
      </div>

      <ReportsTable
        columns={[DAILY_TOTALS_FIRST_COLUMN, ...report.columns, ...DAILY_TOTALS_TRAILING_COLUMNS]}
        rows={report.rows}
        footerRow={report.totalRow}
      />
    </>
  );
}
