import { describeComparisonPeriods } from "@/lib/describeComparisonPeriods";
import { formatHoursMinutes } from "@/lib/formatHoursMinutes";
import type { BehaviourChange, BehaviourChangeNote, BehaviourMetric } from "@/types/highlights";

const METRIC_LABELS: Record<BehaviourMetric, string> = {
  core_work: "Core work",
  activity: "Activity",
  focus_time: "Focus time",
};

/** Under 10%, one decimal — else a real move like 2.8% → 3.5% would read "3% · 3%". */
function formatPercent(percent: number): string {
  return percent < 10 ? `${Math.round(percent * 10) / 10}%` : `${Math.round(percent)}%`;
}

function formatFigure(metric: BehaviourMetric, value: number): string {
  if (metric === "core_work") return formatPercent(value * 100);
  if (metric === "activity") return formatPercent(value);
  return formatHoursMinutes(value);
}

/**
 * A behaviour change in plain words, plus the two figures behind it as
 * comparison bars.
 * "Your own" on your own page, "their own" for anyone else; "the same days
 * of" while only part of the range is over and was compared.
 */
export function describeBehaviourChange(
  change: BehaviourChange,
  comparison: { periodDays: number; periods: number; ownPage: boolean; sameDays: boolean },
): BehaviourChangeNote {
  const whose = comparison.ownPage ? "your own" : "their own";
  const periods = describeComparisonPeriods(comparison.periodDays, comparison.periods);
  const over = comparison.sameDays ? `on the same days of ${periods}` : `over ${periods}`;
  return {
    label: METRIC_LABELS[change.metric],
    change: `${change.changePercent}% ${change.direction}`,
    comparison: `Compared with ${whose} average ${over}.`,
    rows: [
      {
        label: "This period",
        span: { start: 0, end: change.current },
        display: formatFigure(change.metric, change.current),
        highlight: true,
        tone: change.direction === "higher" ? "rise" : "drop",
      },
      {
        label: comparison.ownPage ? "Your average" : "Their average",
        span: { start: 0, end: change.average },
        display: formatFigure(change.metric, change.average),
      },
    ],
    max: Math.max(change.current, change.average),
  };
}
