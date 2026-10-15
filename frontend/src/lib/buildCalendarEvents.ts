import { addDays, startOfDay } from "date-fns";
import { asZonedWallClock, detectTimezone } from "./timezone";
import { splitEntryIntoSegments, type EntrySegment } from "@/lib/splitEntryIntoSegments";
import type { ProjectColour } from "@/types/project";
import type { TimeEntryListItem } from "@/types/timeEntry";
import { entryProjectColour, entryTitle } from "@/lib/entryProjectDisplay";

export type CalendarEvent = {
  /** The Time entry this block came from — one entry can produce several
   * events (pause segments, midnight splits), and they all carry the same
   * id so clicking any of them opens the one underlying entry. */
  entryId: string;
  start: Date;
  end: Date;
  kind: "work" | "paused";
  projectColour: ProjectColour;
  projectName: string;
  taskName: string | null;
  isRunning: boolean;
};

/**
 * react-big-calendar's week time-grid only lays out timed events correctly
 * within a single day — an event whose `start`/`end` straddle midnight gets
 * mis-positioned and its label duplicated across both day columns. Cuts a
 * segment at each local-midnight boundary it crosses so every event handed
 * to the grid stays within one day.
 */
function splitSegmentByDay(segment: EntrySegment): EntrySegment[] {
  const pieces: EntrySegment[] = [];
  let cursor = segment.startedAt;

  while (cursor.getTime() < segment.endedAt.getTime()) {
    const dayEnd = startOfDay(addDays(cursor, 1));
    const pieceEnd = dayEnd < segment.endedAt ? dayEnd : segment.endedAt;
    // A piece ending at exactly 00:00:00.000 is still a different calendar
    // date from its own start, which makes react-big-calendar's
    // `isSameDate` check treat it as a multi-day event and force it into
    // the all-day row instead of the time grid — true whether this
    // midnight boundary came from clipping above, or was already the
    // segment's real end (e.g. an entry that itself ended exactly at
    // midnight). Back it off 1ms so it stays on its own day — display-only,
    // doesn't affect real durations (those come from `entry.durationSeconds`).
    const endsExactlyAtMidnight = pieceEnd.getTime() === startOfDay(pieceEnd).getTime();
    pieces.push({
      startedAt: cursor,
      endedAt: endsExactlyAtMidnight ? new Date(pieceEnd.getTime() - 1) : pieceEnd,
      kind: segment.kind,
    });
    cursor = pieceEnd;
  }

  return pieces;
}

/**
 * Turns a week's entries into calendar-library events, reusing
 * `splitEntryIntoSegments` so a pause renders identically here and in the
 * Daily timeline bar. Real `start`/`end` Date objects — react-big-calendar
 * places each event on its own day/time from these directly, so unlike the
 * old hand-rolled SVG grid this no longer needs to compute a day-of-week
 * index or minute-of-day offset itself.
 */
export function buildCalendarEvents(
  entries: TimeEntryListItem[],
  now: Date = new Date(),
  zone: string = detectTimezone(),
): CalendarEvent[] {
  const events: CalendarEvent[] = [];

  for (const entry of entries) {
    const isRunning = entry.endedAt === null;
    for (const segment of splitEntryIntoSegments(entry, now)) {
      for (const piece of splitSegmentByDay(segment)) {
        events.push({
          entryId: entry.id,
          // Shifted so react-big-calendar, which lays out by a Date's
          // local clock, places these at the chosen zone's wall time.
          // Display only — `entryId` identifies the entry.
          start: asZonedWallClock(piece.startedAt, zone),
          end: asZonedWallClock(piece.endedAt, zone),
          kind: piece.kind,
          projectColour: entryProjectColour(entry),
          projectName: entryTitle(entry),
          taskName: entry.taskName,
          isRunning,
        });
      }
    }
  }

  return events;
}
