"use client";

import clsx from "clsx";
import { useDashboardSummary } from "@/hooks/useDashboardSummary";
import { buildWeekDays } from "@/lib/buildWeekDays";
import { formatElapsed } from "@/lib/formatElapsed";
import { fractionClass } from "@/lib/fractionClass";
import { ErrorMessage } from "./ErrorMessage";
import { Spinner } from "./Spinner";

type ThisWeekPanelProps = {
  organisationId: string;
};

export function ThisWeekPanel({ organisationId }: ThisWeekPanelProps) {
  const summaryQuery = useDashboardSummary(organisationId);

  if (summaryQuery.isLoading) {
    return (
      <p className="flex items-center gap-2 text-slate-900">
        <Spinner className="text-primary-dark" />
        Loading…
      </p>
    );
  }

  if (summaryQuery.isError || !summaryQuery.data) {
    return <ErrorMessage message="Could not load this week's activity." />;
  }

  const days = buildWeekDays(summaryQuery.data.thisWeekByDay);
  const maxSeconds = Math.max(...days.map((day) => day.seconds), 1);

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-input-border p-4">
      <div className="flex h-24 items-end gap-2">
        {days.map((day) => (
          <div
            key={day.label}
            className="flex flex-1 flex-col items-center gap-1"
          >
            <div className="flex h-full w-full items-end">
              <div
                className={clsx(
                  "w-full rounded-t-md",
                  day.isToday ? "bg-primary" : "bg-sidebar-active",
                  fractionClass("h", day.seconds / maxSeconds),
                )}
              />
            </div>
            <span
              className={clsx(
                "text-xs font-medium",
                day.isToday ? "text-primary" : "text-slate-900/70",
              )}
            >
              {day.label}
            </span>
            <span className="text-xs tabular-nums text-slate-900/70">
              {day.seconds > 0 ? formatElapsed(day.seconds * 1000) : "–"}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
