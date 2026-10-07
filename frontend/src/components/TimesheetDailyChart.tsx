"use client";

import clsx from "clsx";
import { HALF_HOUR_MS, useNow } from "@/hooks/useNow";
import { useTimeEntries } from "@/hooks/useTimeEntries";
import { bucketWeekly, buildDailyTotals } from "@/lib/buildDailyTotals";
import { formatElapsed } from "@/lib/formatElapsed";
import { fractionClass } from "@/lib/fractionClass";
import { getTimesheetDateRange } from "@/lib/getTimesheetDateRange";
import { keyAsLocalDate } from "@/lib/timezone";
import type { DateRangePreset } from "@/types/dateRange";
import { ErrorMessage } from "./ErrorMessage";
import { Spinner } from "./Spinner";

type TimesheetDailyChartProps = {
  organisationId: string;
  membershipId?: string;
  datePreset: DateRangePreset;
};

type ChartBar = {
  shortLabel: string;
  tooltipLabel: string;
  seconds: number;
};

// Beyond ~10 bars, fractionClass's 13-step scale and a flex-1 row both
// degrade (banded heights, unreadably thin bars) — coarsen to weekly
// buckets instead.
const MAX_DAILY_BARS = 10;

export function TimesheetDailyChart({
  organisationId,
  membershipId,
  datePreset,
}: TimesheetDailyChartProps) {
  const range = getTimesheetDateRange(datePreset);
  const entriesQuery = useTimeEntries(organisationId, {
    membershipId,
    from: range?.from,
    to: range?.to,
  });
  // Before the early returns below — hooks can't sit after a conditional
  // return.
  const now = useNow(HALF_HOUR_MS);

  if (!range) {
    return null;
  }

  if (entriesQuery.isLoading) {
    return (
      <p className="flex items-center gap-2 text-slate-900">
        <Spinner className="text-primary-dark" />
        Loading…
      </p>
    );
  }

  if (entriesQuery.isError || !entriesQuery.data) {
    return <ErrorMessage message="Could not load this timesheet's chart." />;
  }

  const daily = buildDailyTotals(entriesQuery.data, range.from, range.to, now);
  const bars: ChartBar[] =
    daily.length <= MAX_DAILY_BARS
      ? daily.map((day) => {
          const date = keyAsLocalDate(day.dateKey);
          return {
            shortLabel: date.toLocaleDateString([], { weekday: "short" }),
            tooltipLabel: date.toLocaleDateString([], {
              weekday: "short",
              month: "short",
              day: "numeric",
            }),
            seconds: day.seconds,
          };
        })
      : bucketWeekly(daily).map((bucket) => ({
          shortLabel: bucket.label,
          tooltipLabel: bucket.label,
          seconds: bucket.seconds,
        }));

  const maxSeconds = Math.max(...bars.map((bar) => bar.seconds), 1);

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-input-border p-4">
      {/* Bar track and labels are separate sibling rows so the percentage
          height (`fractionClass("h", …)`) resolves against an unbroken chain
          of explicit heights (h-32 → h-full → h-<fraction>) — see
          ThisWeekPanel.tsx for why nesting the label inside the bar's own
          column breaks this. */}
      <div className="flex h-32 items-end gap-2">
        {bars.map((bar, index) => (
          <div key={index} className="group relative flex h-full flex-1 items-end">
            <div
              className={clsx(
                "w-full rounded-t-md bg-primary",
                fractionClass("h", bar.seconds / maxSeconds),
              )}
            />
            <div className="absolute inset-x-0 bottom-full mb-1 hidden justify-center group-hover:flex">
              <span className="rounded-md bg-primary-dark px-2 py-1 text-xs whitespace-nowrap text-white">
                {bar.tooltipLabel} • {formatElapsed(bar.seconds * 1000)}
              </span>
            </div>
          </div>
        ))}
      </div>
      <div className="flex gap-2">
        {bars.map((bar, index) => (
          <span
            key={index}
            className="flex-1 text-center text-xs text-slate-900/70"
          >
            {bar.shortLabel}
          </span>
        ))}
      </div>
    </div>
  );
}
