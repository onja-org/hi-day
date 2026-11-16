import { buildComparisonRows } from "@/lib/buildComparisonRows";
import { comparisonScaleMax } from "@/lib/comparisonScaleMax";
import { formatHoursMinutes } from "@/lib/formatHoursMinutes";
import type { PerformanceCardInput } from "@/types/insights";
import { ComparisonBars } from "./ComparisonBars";
import { PerformanceCard } from "./PerformanceCard";

/** Stretches of 20+ minutes of tracked time with activity at 50% or more. */
export function FocusTimeCard({ report, memberLabel }: PerformanceCardInput) {
  const focus = report.member.focus;
  if (report.activityStatus === "disabled") {
    return <PerformanceCard title="Focus time" notice="Record activity disabled" />;
  }
  if (!focus) {
    return <PerformanceCard title="Focus time" notice="Not enough data" />;
  }

  const rows = buildComparisonRows({
    memberLabel,
    member: focus.totalSeconds,
    team: report.averages.team?.focusSeconds,
    organisation: report.averages.organisation.focusSeconds,
    toSpan: (seconds) => ({ start: 0, end: seconds }),
    format: formatHoursMinutes,
  });

  return (
    <PerformanceCard
      title="Focus time"
      comparison={<ComparisonBars rows={rows} max={comparisonScaleMax(rows.map((row) => row.span?.end ?? null))} />}
    >
      <p className="font-data text-2xl text-slate-900">{formatHoursMinutes(focus.totalSeconds)}</p>
      <p className="text-sm text-secondary">
        {focus.sessions} {focus.sessions === 1 ? "session" : "sessions"}
        {focus.sessions > 0 && `, ${formatHoursMinutes(focus.averageSessionSeconds)} on average`}
      </p>
      <p className="text-xs text-secondary">20+ minutes of tracked time at 50%+ activity</p>
    </PerformanceCard>
  );
}
