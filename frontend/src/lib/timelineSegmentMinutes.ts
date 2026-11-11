import type { TimelineSegment } from "@/types/insights";

const MINUTES_PER_DAY = 24 * 60;

/**
 * Where a Timeline segment sits on its day's bar, in minutes from the day's
 * start, clamped to `[0, minutesInDay]`. A daylight-saving day is 23 or 25
 * hours long, so pass its real length rather than assuming 24.
 */
export function timelineSegmentMinutes(
  segment: Pick<TimelineSegment, "start" | "end">,
  dayStart: Date,
  minutesInDay: number = MINUTES_PER_DAY,
): { startMinute: number; endMinute: number } {
  const toMinute = (iso: string) =>
    Math.min(
      minutesInDay,
      Math.max(0, (new Date(iso).getTime() - dayStart.getTime()) / 60000),
    );
  return { startMinute: toMinute(segment.start), endMinute: toMinute(segment.end) };
}
