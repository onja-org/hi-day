"use client";

import { useState } from "react";
import { CaretUpIcon, ClockIcon, CreditCardIcon } from "@phosphor-icons/react";
import { buildTimeActivityChartRows } from "@/lib/buildTimeActivityChartRows";
import { buildTimeActivityRows, totalEntrySeconds } from "@/lib/buildTimeActivityRows";
import { formatElapsed } from "@/lib/formatElapsed";
import {
  TIME_ACTIVITY_CHART_SERIES,
  canSumDates,
  timeActivityColumns,
} from "@/lib/timeActivityReportConfig";
import type { IdleMember } from "@/types/idleMember";
import type { ReportTableRow } from "@/types/reportTable";
import type { MembershipTeamNames, TimeActivityGrouping } from "@/types/timeActivityGrouping";
import type { TimeEntryListItem } from "@/types/timeEntry";
import { getInitials } from "@/lib/getInitials";
import { AvatarStack } from "@/components/AvatarStack";
import { ReportsBarChart } from "./ReportsBarChart";
import { ReportsStatCard } from "./ReportsStatCard";
import { ReportsTable } from "./ReportsTable";

type TimeActivityReportBodyProps = {
  entries: TimeEntryListItem[];
  grouping: TimeActivityGrouping;
  teamNames: MembershipTeamNames;
  idleMembers: IdleMember[];
};

/** Avatars on a top-level row; nested rows carry their team names as plain text. */
function renderTeamCell(row: ReportTableRow) {
  if (!row.teams) return row.cells.team ?? "-";
  return (
    <AvatarStack
      items={(row.teams ?? []).map((name) => ({ id: name, label: name, initials: getInitials(name) }))}
      emptyLabel="-"
    />
  );
}

export function TimeActivityReportBody({ entries, grouping, teamNames, idleMembers }: TimeActivityReportBodyProps) {
  const [sumDates, setSumDates] = useState(false);

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

      {grouping === "none" ? (
        <p className="rounded-lg border border-input-border bg-white p-6 text-center text-slate-900/70">
          Chart not available when data is grouped by none
        </p>
      ) : (
        <details open className="group rounded-lg border border-input-border bg-white">
          <summary className="flex cursor-pointer list-none items-center justify-between p-4 text-lg font-semibold text-primary-dark">
            Chart
            <CaretUpIcon
              size={16}
              aria-hidden="true"
              className="text-primary rotate-180 transition-transform duration-150 group-open:rotate-0"
            />
          </summary>
          <div className="p-4 pt-0">
            <ReportsBarChart
              rows={buildTimeActivityChartRows(entries, grouping, teamNames)}
              series={TIME_ACTIVITY_CHART_SERIES}
            />
          </div>
        </details>
      )}

      <ReportsTable
        key={grouping}
        columns={timeActivityColumns(grouping).map((column) =>
          column.key === "team" ? { ...column, renderCell: renderTeamCell } : column,
        )}
        rows={buildTimeActivityRows(entries, grouping, { sumDates, teamNames, idleMembers })}
        toolbarExtra={
          canSumDates(grouping) && (
            <label className="mr-2 flex cursor-pointer items-center gap-2 text-xs text-slate-900">
              <input
                type="checkbox"
                checked={sumDates}
                onChange={(event) => setSumDates(event.target.checked)}
              />
              Sum dates
            </label>
          )
        }
      />
    </>
  );
}
