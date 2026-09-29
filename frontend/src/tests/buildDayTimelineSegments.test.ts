import { describe, expect, it } from "vitest";
import { buildDayTimelineSegments } from "@/lib/buildDayTimelineSegments";
import type { TimeEntryListItem } from "@/types/timeEntry";

function makeEntry(overrides: Partial<TimeEntryListItem> = {}): TimeEntryListItem {
  return {
    id: "te-1",
    membershipId: "m-1",
    projectId: "p-1",
    projectName: "Website",
    projectColour: "blue",
    taskId: null,
    taskName: null,
    startedAt: "2026-01-05T09:00:00.000Z",
    endedAt: "2026-01-05T10:00:00.000Z",
    source: "web",
    deviceId: null,
    pausedAt: null,
    pausedSeconds: 0,
    durationSeconds: 3600,
    memberName: "Sam Rivers",
    memberEmail: "sam@example.test",
    canEdit: true,
    canDelete: true,
    pauses: [],
    ...overrides,
  };
}

describe("buildDayTimelineSegments", () => {
  it("converts an entry to minute offsets from the given day start", () => {
    const dayStart = new Date(2026, 0, 5, 0, 0, 0, 0);
    const entry = makeEntry({
      startedAt: new Date(2026, 0, 5, 9, 0).toISOString(),
      endedAt: new Date(2026, 0, 5, 10, 30).toISOString(),
    });

    const segments = buildDayTimelineSegments([entry], dayStart);

    expect(segments).toEqual([
      {
        startMinute: 540,
        endMinute: 630,
        kind: "work",
        projectColour: "blue",
        projectName: "Website",
        startedAt: new Date(2026, 0, 5, 9, 0),
        endedAt: new Date(2026, 0, 5, 10, 30),
      },
    ]);
  });

  it("splits a paused entry into work/paused/work segments", () => {
    const dayStart = new Date(2026, 0, 5, 0, 0, 0, 0);
    const entry = makeEntry({
      startedAt: new Date(2026, 0, 5, 9, 0).toISOString(),
      endedAt: new Date(2026, 0, 5, 11, 0).toISOString(),
      pauses: [
        {
          pausedAt: new Date(2026, 0, 5, 9, 30).toISOString(),
          resumedAt: new Date(2026, 0, 5, 9, 45).toISOString(),
        },
      ],
    });

    const segments = buildDayTimelineSegments([entry], dayStart);

    expect(segments).toEqual([
      {
        startMinute: 540,
        endMinute: 570,
        kind: "work",
        projectColour: "blue",
        projectName: "Website",
        startedAt: new Date(2026, 0, 5, 9, 0),
        endedAt: new Date(2026, 0, 5, 9, 30),
      },
      {
        startMinute: 570,
        endMinute: 585,
        kind: "paused",
        projectColour: "blue",
        projectName: "Website",
        startedAt: new Date(2026, 0, 5, 9, 30),
        endedAt: new Date(2026, 0, 5, 9, 45),
      },
      {
        startMinute: 585,
        endMinute: 660,
        kind: "work",
        projectColour: "blue",
        projectName: "Website",
        startedAt: new Date(2026, 0, 5, 9, 45),
        endedAt: new Date(2026, 0, 5, 11, 0),
      },
    ]);
  });

  it("clamps a segment that would extend past midnight to the day's end", () => {
    const dayStart = new Date(2026, 0, 5, 0, 0, 0, 0);
    const now = new Date(2026, 0, 5, 23, 50);
    const entry = makeEntry({
      startedAt: new Date(2026, 0, 5, 23, 0).toISOString(),
      endedAt: null,
      durationSeconds: null,
    });

    const segments = buildDayTimelineSegments([entry], dayStart, now);

    expect(segments).toEqual([
      {
        startMinute: 1380,
        endMinute: 1430,
        kind: "work",
        projectColour: "blue",
        projectName: "Website",
        startedAt: new Date(2026, 0, 5, 23, 0),
        endedAt: now,
      },
    ]);
  });

  it("drops a zero-length segment", () => {
    const dayStart = new Date(2026, 0, 5, 0, 0, 0, 0);
    const entry = makeEntry({
      startedAt: new Date(2026, 0, 5, 9, 0).toISOString(),
      endedAt: new Date(2026, 0, 5, 9, 0).toISOString(),
      durationSeconds: 0,
    });

    expect(buildDayTimelineSegments([entry], dayStart)).toEqual([]);
  });
});
