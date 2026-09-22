import { splitEntryIntoSegments } from "@/lib/splitEntryIntoSegments";
import type { ProjectColour } from "@/types/project";
import type { TimeEntryListItem } from "@/types/timeEntry";

export type TimelineSegment = {
  startMinute: number;
  endMinute: number;
  kind: "work" | "paused";
  projectColour: ProjectColour;
  projectName: string;
  /** The segment's real start/end instants (not clamped to the day), for a hover tooltip. */
  startedAt: Date;
  endedAt: Date;
};

const MINUTES_PER_DAY = 24 * 60;

function minutesSinceMidnight(date: Date, dayStart: Date): number {
  return (date.getTime() - dayStart.getTime()) / 60000;
}

/**
 * Converts one day's entries into clamped `[0, 1440)`-minute segments for
 * the Daily view's occupancy bar, reusing `splitEntryIntoSegments` so a
 * pause renders identically here and in the Calendar grid.
 */
export function buildDayTimelineSegments(
  entries: TimeEntryListItem[],
  dayStart: Date,
  now: Date = new Date(),
): TimelineSegment[] {
  const segments: TimelineSegment[] = [];

  for (const entry of entries) {
    for (const segment of splitEntryIntoSegments(entry, now)) {
      const startMinute = Math.max(0, minutesSinceMidnight(segment.startedAt, dayStart));
      const endMinute = Math.min(
        MINUTES_PER_DAY,
        minutesSinceMidnight(segment.endedAt, dayStart),
      );
      if (endMinute <= startMinute) continue;

      segments.push({
        startMinute,
        endMinute,
        kind: segment.kind,
        projectColour: entry.projectColour,
        projectName: entry.projectName,
        startedAt: segment.startedAt,
        endedAt: segment.endedAt,
      });
    }
  }

  return segments;
}
