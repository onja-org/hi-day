"use client";

import { Bar, BarChart, Cell, ResponsiveContainer, XAxis } from "recharts";
import clsx from "clsx";
import { useDashboardSummary } from "@/hooks/useDashboardSummary";
import { buildWeekDays } from "@/lib/buildWeekDays";
import { formatElapsed } from "@/lib/formatElapsed";
import { ErrorMessage } from "./ErrorMessage";
import { Spinner } from "./Spinner";

type ThisWeekPanelProps = {
  organisationId: string;
};

const BAR_SIZE = 20;
// A day with zero tracked time still gets a small sliver in the chart data
// (not in the label below it) so every column shows a visible baseline bar
// instead of fully disappearing.
const MIN_VISIBLE_RATIO = 0.03;

function barColor(seconds: number, isToday: boolean): string {
  if (isToday) return "var(--color-primary)";
  return seconds > 0 ? "var(--color-success)" : "var(--color-sidebar-active)";
}

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
  const chartData = days.map((day) => ({
    ...day,
    displaySeconds: day.seconds > 0 ? day.seconds : maxSeconds * MIN_VISIBLE_RATIO,
  }));

  return (
    <div className="flex flex-col gap-1 rounded-lg border border-input-border p-4">
      <div className="h-24">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
            <XAxis dataKey="label" hide />
            <Bar dataKey="displaySeconds" radius={0} barSize={BAR_SIZE} isAnimationActive={false}>
              {chartData.map((day, index) => (
                <Cell key={index} fill={barColor(day.seconds, day.isToday)} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div className="flex gap-2">
        {days.map((day, index) => (
          <div key={index} className="flex flex-1 flex-col items-center gap-1">
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
