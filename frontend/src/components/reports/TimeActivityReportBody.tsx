import { ClockIcon, CreditCardIcon } from "@phosphor-icons/react";
import { buildTimeActivityChartRows } from "@/lib/buildTimeActivityChartRows";
import { buildTimeActivityRows, totalEntrySeconds } from "@/lib/buildTimeActivityRows";
import { formatElapsed } from "@/lib/formatElapsed";
import {
  TIME_ACTIVITY_CHART_SERIES,
  TIME_ACTIVITY_DEFAULT_HIDDEN_COLUMNS,
  timeActivityColumns,
} from "@/lib/timeActivityReportConfig";
import type { ReportScope } from "@/types/reportScope";
import type { TimeActivityGrouping } from "@/types/timeActivityGrouping";
import type { TimeEntryListItem } from "@/types/timeEntry";
import { ReportsBarChart } from "./ReportsBarChart";
import { ReportsStatCard } from "./ReportsStatCard";
import { ReportsTable } from "./ReportsTable";

type TimeActivityReportBodyProps = {
  entries: TimeEntryListItem[];
  grouping: TimeActivityGrouping;
  scope: ReportScope;
};

export function TimeActivityReportBody({ entries, grouping, scope }: TimeActivityReportBodyProps) {
  return (
    <>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <ReportsStatCard
          label="Total time"
          value={formatElapsed(totalEntrySeconds(entries) * 1000)}
          icon={ClockIcon}
        />
        <ReportsStatCard label="Total earned" value="--" icon={CreditCardIcon} />
      </div>

      <details open className="group rounded-lg border border-input-border bg-white">
        <summary className="cursor-pointer list-none p-4 text-lg font-semibold text-primary-dark">
          Chart
        </summary>
        <div className="p-4 pt-0">
          <ReportsBarChart
            rows={buildTimeActivityChartRows(entries, grouping)}
            series={TIME_ACTIVITY_CHART_SERIES}
          />
        </div>
      </details>

      <ReportsTable
        key={`${scope}-${grouping}`}
        columns={timeActivityColumns(grouping)}
        rows={buildTimeActivityRows(entries, grouping)}
        // Every row is the viewer's own in "Me", so a Member column is noise there.
        defaultHiddenKeys={
          scope === "me"
            ? [...TIME_ACTIVITY_DEFAULT_HIDDEN_COLUMNS, "member"]
            : TIME_ACTIVITY_DEFAULT_HIDDEN_COLUMNS
        }
      />
    </>
  );
}
