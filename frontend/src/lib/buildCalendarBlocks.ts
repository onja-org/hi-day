import { splitEntryIntoSegments } from "@/lib/splitEntryIntoSegments";
import type { ProjectColour } from "@/types/project";
import type { TimeEntryListItem } from "@/types/timeEntry";

export type CalendarBlock = {
  dayIndex: number;
  startMinute: number;
  endMinute: number;
  kind: "work" | "paused";
  projectColour: ProjectColour;
  isRunning: boolean;
};

const MINUTES_PER_DAY = 24 * 60;

// Calendar-day difference via UTC epoch of just the y/m/d parts — dividing
// two local-midnight Dates' getTime() by a fixed 24h-in-ms would misfire
// across a daylight-saving transition (some local days aren't 24h long).
function daysBetween(from: Date, to: Date): number {
  const fromUtc = Date.UTC(from.getFullYear(), from.getMonth(), from.getDate());
  const toUtc = Date.UTC(to.getFullYear(), to.getMonth(), to.getDate());
  return Math.round((toUtc - fromUtc) / 86_400_000);
}

/**
 * Positions a week's entries as day-column/minute-of-day blocks for the
 * Calendar grid, reusing `splitEntryIntoSegments` so a pause renders
 * identically here and in the Daily timeline bar. `weekStart` must be local
 * midnight of the grid's first (Monday) column. A segment is defensively
 * clamped to the single calendar day it starts on — the backend already
 * auto-splits running entries at midnight, so a segment spanning two days
 * should not occur in practice, but this keeps the grid correct even if one
 * ever does.
 */
export function buildCalendarBlocks(
  entries: TimeEntryListItem[],
  weekStart: Date,
  now: Date = new Date(),
): CalendarBlock[] {
  const blocks: CalendarBlock[] = [];

  for (const entry of entries) {
    const isRunning = entry.endedAt === null;
    for (const segment of splitEntryIntoSegments(entry, now)) {
      const segmentDayStart = new Date(
        segment.startedAt.getFullYear(),
        segment.startedAt.getMonth(),
        segment.startedAt.getDate(),
      );
      const dayIndex = daysBetween(weekStart, segmentDayStart);
      if (dayIndex < 0 || dayIndex > 6) continue;

      const startMinute = (segment.startedAt.getTime() - segmentDayStart.getTime()) / 60000;
      const endMinute = Math.min(
        MINUTES_PER_DAY,
        (segment.endedAt.getTime() - segmentDayStart.getTime()) / 60000,
      );
      if (endMinute <= startMinute) continue;

      blocks.push({
        dayIndex,
        startMinute,
        endMinute,
        kind: segment.kind,
        projectColour: entry.projectColour,
        isRunning,
      });
    }
  }

  return blocks;
}
