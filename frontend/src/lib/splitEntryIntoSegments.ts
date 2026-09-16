import type { TimeEntryListItem } from "@/types/timeEntry";

export type EntrySegment = {
  startedAt: Date;
  endedAt: Date;
  kind: "work" | "paused";
};

/**
 * Turns one entry into alternating work/paused sub-spans using its exact
 * `pauses` (oldest first) — the one place this math lives, so the Daily
 * timeline bar and the Calendar grid never re-derive it independently and
 * risk disagreeing. A still-open pause, or a still-running entry with no
 * `endedAt`, closes its final segment at `now`.
 */
export function splitEntryIntoSegments(
  entry: TimeEntryListItem,
  now: Date = new Date(),
): EntrySegment[] {
  const segments: EntrySegment[] = [];
  let cursor = new Date(entry.startedAt);
  const entryEnd = entry.endedAt ? new Date(entry.endedAt) : now;

  for (const pause of entry.pauses) {
    const pausedAt = new Date(pause.pausedAt);
    if (pausedAt.getTime() > cursor.getTime()) {
      segments.push({ startedAt: cursor, endedAt: pausedAt, kind: "work" });
    }
    const resumedAt = pause.resumedAt ? new Date(pause.resumedAt) : now;
    segments.push({ startedAt: pausedAt, endedAt: resumedAt, kind: "paused" });
    cursor = resumedAt;

    if (!pause.resumedAt) {
      return segments;
    }
  }

  if (entryEnd.getTime() > cursor.getTime()) {
    segments.push({ startedAt: cursor, endedAt: entryEnd, kind: "work" });
  }

  return segments;
}
