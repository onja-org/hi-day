import type {
  MemberUnusualActivity,
  SecondsBySeverity,
  UnusualActivitySummary,
  UnusualSeverity,
} from "@/types/unusualActivity";

const SEVERITIES: UnusualSeverity[] = ["highly_unusual", "unusual", "slightly_unusual"];

/**
 * The page's figures for the selected severities. Counts always cover every
 * severity, so a filter button can say how many it would show; the list and
 * both time totals follow the selection.
 */
export function summariseUnusualActivity(
  report: Pick<MemberUnusualActivity, "instances" | "affectedSeconds" | "previousPeriod">,
  selected: UnusualSeverity[],
): UnusualActivitySummary {
  const total = (seconds: SecondsBySeverity) =>
    selected.reduce((sum, severity) => sum + seconds[severity], 0);

  return {
    counts: Object.fromEntries(
      SEVERITIES.map((severity) => [
        severity,
        report.instances.filter((instance) => instance.severity === severity).length,
      ]),
    ) as Record<UnusualSeverity, number>,
    instances: report.instances.filter((instance) => selected.includes(instance.severity)),
    affectedSeconds: total(report.affectedSeconds),
    previousAffectedSeconds: total(report.previousPeriod.affectedSeconds),
  };
}
