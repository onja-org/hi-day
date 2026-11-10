import type { Interval } from '../common/time-entry-union.util';
import { mergeIntervals } from '../common/time-entry-union.util';

/** Hubstaff's own granularity, and one ActivitySample period. */
export const SLOT_MINUTES = 10;
const SLOT_MS = SLOT_MINUTES * 60_000;

export interface SamplePeriod {
  periodStart: Date;
  periodEnd: Date;
  activePercentage: number;
}

/** Tracked time, pauses already netted out. */
export interface ProjectInterval extends Interval {
  projectId: string | null;
}

export interface SlotActivity {
  /** 0-100, or null when no sample covers any of the slot. */
  activePercentage: number | null;
  measuredSeconds: number;
}

/** Stepped rather than assuming 144: the count is whatever fits the
 * window, and the last slot is clipped to its end. */
export function slotsBetween(dayStart: Date, dayEnd: Date): Interval[] {
  const slots: Interval[] = [];
  const endMs = dayEnd.getTime();
  for (let start = dayStart.getTime(); start < endMs; start += SLOT_MS) {
    slots.push({ start, end: Math.min(start + SLOT_MS, endMs) });
  }
  return slots;
}

/** The part of each interval inside `window`, empty ones dropped. */
export function clipTo(intervals: Interval[], window: Interval): Interval[] {
  return intervals.flatMap((interval) => {
    const start = Math.max(interval.start, window.start);
    const end = Math.min(interval.end, window.end);
    return end > start ? [{ start, end }] : [];
  });
}

/** Shared stretches counted once, the same union rule the timesheet's own
 * total uses (docs/adr/0022). */
export function workedSecondsIn(
  intervals: Interval[],
  window: Interval,
): number {
  const total = mergeIntervals(clipTo(intervals, window)).reduce(
    (sum, interval) => sum + (interval.end - interval.start),
    0,
  );
  return Math.max(0, Math.round(total / 1000));
}

/** A slot can straddle a switch, so it needs one answer: most seconds
 * inside it wins, ties to whichever came first. */
export function dominantProjectIn(
  intervals: ProjectInterval[],
  window: Interval,
): string | null {
  const byProject = new Map<string, number>();
  for (const interval of intervals) {
    if (interval.projectId === null) continue;
    const start = Math.max(interval.start, window.start);
    const end = Math.min(interval.end, window.end);
    if (end <= start) continue;
    byProject.set(
      interval.projectId,
      (byProject.get(interval.projectId) ?? 0) + (end - start),
    );
  }

  let best: string | null = null;
  let bestMs = 0;
  for (const [projectId, ms] of byProject) {
    if (ms > bestMs) {
      best = projectId;
      bestMs = ms;
    }
  }
  return best;
}

/**
 * Weighted by overlap, because sample periods are **not** clock-aligned —
 * the agent opens one when the timer starts ticking, so a period can run
 * 09:03–09:13 and a slot has no "its" sample. Same rule
 * `TimeEntriesService.getActivityFor` applies to an entry, so the two never
 * give different answers. Null, never 0, when nothing covers the slot.
 */
export function activityIn(
  samples: SamplePeriod[],
  window: Interval,
): SlotActivity {
  let weighted = 0;
  let measuredMs = 0;
  for (const sample of samples) {
    const start = Math.max(sample.periodStart.getTime(), window.start);
    const end = Math.min(sample.periodEnd.getTime(), window.end);
    if (end <= start) continue;
    weighted += sample.activePercentage * (end - start);
    measuredMs += end - start;
  }
  return {
    activePercentage: measuredMs > 0 ? Math.round(weighted / measuredMs) : null,
    measuredSeconds: Math.round(measuredMs / 1000),
  };
}

/** Weighted by measured time, so a two-minute slot counts a fifth of a
 * ten-minute one rather than swinging the day. */
export function weightedAverage(
  parts: { activePercentage: number | null; measuredSeconds: number }[],
): number | null {
  let weighted = 0;
  let seconds = 0;
  for (const part of parts) {
    if (part.activePercentage === null || part.measuredSeconds <= 0) continue;
    weighted += part.activePercentage * part.measuredSeconds;
    seconds += part.measuredSeconds;
  }
  return seconds > 0 ? Math.round(weighted / seconds) : null;
}
