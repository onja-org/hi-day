import clsx from "clsx";
import { buildComparisonRows } from "@/lib/buildComparisonRows";
import { comparisonScaleMax } from "@/lib/comparisonScaleMax";
import { describeTargetGap } from "@/lib/describeTargetGap";
import { formatHoursMinutes } from "@/lib/formatHoursMinutes";
import type { PerformanceCardInput } from "@/types/insights";
import { ComparisonBars } from "./ComparisonBars";
import { PerformanceCard } from "./PerformanceCard";

/** Daily working average against the Work schedule's daily target. */
export function UtilizationCard({ report, memberLabel }: PerformanceCardInput) {
  const utilization = report.member.utilization;
  if (!utilization) {
    return <PerformanceCard title="Utilization" notice="Not enough data" />;
  }

  const gap = describeTargetGap(utilization.averageDailySeconds, utilization.targetDailySeconds);
  const rows = buildComparisonRows({
    memberLabel,
    member: utilization.averageDailySeconds,
    team: report.averages.team?.averageDailySeconds,
    organisation: report.averages.organisation.averageDailySeconds,
    toSpan: (seconds) => ({ start: 0, end: seconds }),
    format: formatHoursMinutes,
  });
  const max = comparisonScaleMax([
    utilization.targetDailySeconds,
    ...rows.map((row) => row.span?.end ?? null),
  ]);

  return (
    <PerformanceCard title="Utilization" comparison={<ComparisonBars rows={rows} max={max} />}>
      <p className="font-data text-2xl text-slate-900">
        {formatHoursMinutes(utilization.averageDailySeconds)}
        <span className="text-sm text-secondary"> / day</span>
      </p>
      <p className="text-sm text-secondary">
        Target {formatHoursMinutes(utilization.targetDailySeconds)} over {utilization.expectedDays}{" "}
        work {utilization.expectedDays === 1 ? "day" : "days"}
      </p>
      <p
        className={clsx(
          "w-fit rounded-brand-sm px-2 py-1 text-sm font-semibold",
          gap.direction === "below" && "bg-error/10 text-error",
          gap.direction === "above" && "bg-success/10 text-success",
          gap.direction === "on" && "bg-cream text-slate-900",
        )}
      >
        {gap.label}
      </p>
    </PerformanceCard>
  );
}
