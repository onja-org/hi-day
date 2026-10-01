"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  XAxis,
  YAxis,
} from "recharts";
import { buildHourTicks } from "@/lib/buildHourTicks";
import { flattenReportChartRows } from "@/lib/flattenReportChartRows";
import { formatHourTick } from "@/lib/formatHourTick";
import type { ReportChartRow, ReportChartSeries } from "@/types/reportChart";

type ReportsBarChartProps = {
  rows: ReportChartRow[];
  series: ReportChartSeries[];
};

const BAR_SIZE = 6;
const TICK = { fill: "var(--color-slate-900)", fontSize: 12 };

/** Grouped bars (one per series) per x-axis slot, with a whole-hours Y axis. Values are in seconds. */
export function ReportsBarChart({ rows, series }: ReportsBarChartProps) {
  const data = flattenReportChartRows(rows, series);
  const maxSeconds = Math.max(
    0,
    ...rows.flatMap((row) => series.map(({ key }) => row.values[key] ?? 0)),
  );
  const ticks = buildHourTicks(maxSeconds);

  return (
    <div className="h-72 rounded-lg border border-input-border bg-white p-4">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 0, right: 8, bottom: 0, left: 0 }}>
          <CartesianGrid vertical={false} stroke="var(--color-input-border)" />
          <XAxis
            dataKey="label"
            tick={TICK}
            tickLine={false}
            axisLine={{ stroke: "var(--color-input-border)" }}
          />
          <YAxis
            ticks={ticks}
            domain={[0, ticks[ticks.length - 1]]}
            tickFormatter={formatHourTick}
            tick={TICK}
            tickLine={false}
            axisLine={false}
            width={40}
          />
          <Legend verticalAlign="top" align="right" iconType="circle" iconSize={10} />
          {series.map(({ key, label, color }) => (
            <Bar
              key={key}
              dataKey={key}
              name={label}
              fill={color}
              barSize={BAR_SIZE}
              radius={[3, 3, 0, 0]}
              isAnimationActive={false}
            />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
