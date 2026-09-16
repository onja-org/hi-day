import { describe, expect, it } from "vitest";
import { buildCalendarBlocks } from "@/lib/buildCalendarBlocks";
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
    canEdit: true,
    pauses: [],
    ...overrides,
  };
}

describe("buildCalendarBlocks", () => {
  const weekStart = new Date(2026, 0, 5, 0, 0, 0, 0); // Monday

  it("places an entry on its day-of-week column at the right minute offset", () => {
    const entry = makeEntry({
      startedAt: new Date(2026, 0, 7, 9, 0).toISOString(), // Wednesday, dayIndex 2
      endedAt: new Date(2026, 0, 7, 10, 30).toISOString(),
    });

    const blocks = buildCalendarBlocks([entry], weekStart);

    expect(blocks).toEqual([
      {
        dayIndex: 2,
        startMinute: 540,
        endMinute: 630,
        kind: "work",
        projectColour: "blue",
        isRunning: false,
      },
    ]);
  });

  it("marks a still-running entry's block as running", () => {
    const now = new Date(2026, 0, 5, 9, 30);
    const entry = makeEntry({
      startedAt: new Date(2026, 0, 5, 9, 0).toISOString(),
      endedAt: null,
      durationSeconds: null,
    });

    const blocks = buildCalendarBlocks([entry], weekStart, now);

    expect(blocks).toEqual([
      {
        dayIndex: 0,
        startMinute: 540,
        endMinute: 570,
        kind: "work",
        projectColour: "blue",
        isRunning: true,
      },
    ]);
  });

  it("drops an entry whose day falls outside the requested week", () => {
    const entry = makeEntry({
      startedAt: new Date(2026, 0, 20, 9, 0).toISOString(),
      endedAt: new Date(2026, 0, 20, 10, 0).toISOString(),
    });

    expect(buildCalendarBlocks([entry], weekStart)).toEqual([]);
  });

  it("splits a paused entry into work/paused blocks on the same day", () => {
    const entry = makeEntry({
      startedAt: new Date(2026, 0, 6, 9, 0).toISOString(), // Tuesday, dayIndex 1
      endedAt: new Date(2026, 0, 6, 11, 0).toISOString(),
      pauses: [
        {
          pausedAt: new Date(2026, 0, 6, 9, 30).toISOString(),
          resumedAt: new Date(2026, 0, 6, 9, 45).toISOString(),
        },
      ],
    });

    const blocks = buildCalendarBlocks([entry], weekStart);

    expect(blocks).toEqual([
      { dayIndex: 1, startMinute: 540, endMinute: 570, kind: "work", projectColour: "blue", isRunning: false },
      { dayIndex: 1, startMinute: 570, endMinute: 585, kind: "paused", projectColour: "blue", isRunning: false },
      { dayIndex: 1, startMinute: 585, endMinute: 660, kind: "work", projectColour: "blue", isRunning: false },
    ]);
  });
});
