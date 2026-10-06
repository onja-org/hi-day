"use client";

import type { ReactNode } from "react";
import { ClockIcon, FolderSimpleIcon } from "@phosphor-icons/react";
import { DAILY_TOTALS_CHART_SERIES } from "@/lib/dailyTotalsReportConfig";
import { dailyTotalsTable } from "@/lib/dailyTotalsTable";
import { formatElapsed } from "@/lib/formatElapsed";
import { formatReportDay } from "@/lib/formatReportDay";
import type { DailyTotalsReport } from "@/lib/buildDailyTotalsReport";
import { ReportsBarChart } from "./ReportsBarChart";
import { ReportsStatCard } from "./ReportsStatCard";
import { ReportTableHeading } from "./ReportTableHeading";
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

      <ReportTableHeading organisationName={organisationName} zone={zone} actions={actions} />

      <ReportsTable
        columns={dailyTotalsTable(report).columns}
        rows={report.rows}
        footerRow={report.totalRow}
      />
    </>
  );
}
