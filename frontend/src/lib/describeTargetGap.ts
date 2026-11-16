import { formatHoursMinutes } from "./formatHoursMinutes";

export type TargetGap = {
  direction: "above" | "below" | "on";
  label: string;
};

/** Within this many seconds of the target counts as on it — a minute's drift isn't news. */
const ON_TARGET_TOLERANCE_SECONDS = 60;

/** The Utilization badge: how far a daily average sits from the daily target. */
export function describeTargetGap(averageSeconds: number, targetSeconds: number): TargetGap {
  const gap = averageSeconds - targetSeconds;
  if (Math.abs(gap) < ON_TARGET_TOLERANCE_SECONDS) {
    return { direction: "on", label: "On target" };
  }
  const direction = gap > 0 ? "above" : "below";
  const label = `${direction === "above" ? "Above" : "Below"} target by ${formatHoursMinutes(Math.abs(gap))}`;
  return { direction, label };
}
