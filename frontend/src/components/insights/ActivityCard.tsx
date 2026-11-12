import { buildComparisonRows } from "@/lib/buildComparisonRows";
import type { PerformanceCardInput } from "@/types/insights";
import { ComparisonBars } from "./ComparisonBars";
import { PerformanceCard } from "./PerformanceCard";

/** Average activity over the range's tracked time. */
export function ActivityCard({ report, memberLabel }: PerformanceCardInput) {
  const activity = report.member.activity;
  if (report.activityStatus === "disabled") {
    return <PerformanceCard title="Activity" notice="Record activity disabled" />;
  }
  if (!activity) {
    return <PerformanceCard title="Activity" notice="Not enough data" />;
  }

  const rows = buildComparisonRows({
    memberLabel,
    member: activity.percentage,
    team: report.averages.team?.activityPercentage,
    organisation: report.averages.organisation.activityPercentage,
    toSpan: (percentage) => ({ start: 0, end: percentage }),
    format: (percentage) => `${percentage}%`,
  });

  return (
    <PerformanceCard title="Activity" comparison={<ComparisonBars rows={rows} max={100} />}>
      <p className="font-data text-2xl text-slate-900">{activity.percentage}%</p>
      <p className="text-sm text-secondary">Average over tracked time</p>
    </PerformanceCard>
  );
}
