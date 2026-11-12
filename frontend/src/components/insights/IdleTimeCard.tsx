import { buildComparisonRows } from "@/lib/buildComparisonRows";
import { comparisonScaleMax } from "@/lib/comparisonScaleMax";
import { formatHoursMinutes } from "@/lib/formatHoursMinutes";
import type { PerformanceCardInput } from "@/types/insights";
import { ComparisonBars } from "./ComparisonBars";
import { PerformanceCard } from "./PerformanceCard";

const toPercent = (share: number) => `${Math.round(share * 100)}%`;

/** How much of the tracked time was idle. */
export function IdleTimeCard({ report, memberLabel }: PerformanceCardInput) {
  const idle = report.member.idle;
  if (!idle) {
    return <PerformanceCard title="Idle time" notice="Not enough data" />;
  }

  const rows = buildComparisonRows({
    memberLabel,
    member: idle.idleShare,
    team: report.averages.team?.idleShare,
    organisation: report.averages.organisation.idleShare,
    toSpan: (share) => ({ start: 0, end: share }),
    format: toPercent,
  });

  return (
    <PerformanceCard
      title="Idle time"
      comparison={<ComparisonBars rows={rows} max={comparisonScaleMax(rows.map((row) => row.span?.end ?? null), 0.01)} />}
    >
      <p className="font-data text-2xl text-slate-900">{toPercent(idle.idleShare)}</p>
      <p className="text-sm text-secondary">{formatHoursMinutes(idle.idleSeconds)} of tracked time was idle</p>
    </PerformanceCard>
  );
}
