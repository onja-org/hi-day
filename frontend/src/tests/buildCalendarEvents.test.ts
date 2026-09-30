import { describe, expect, it } from "vitest";
import { buildCalendarEvents } from "@/lib/buildCalendarEvents";
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
    type: "normal",
    activePercentage: null,
    memberName: "Sam Rivers",
    memberEmail: "sam@example.test",
    canEdit: true,
    canDelete: true,
    pauses: [],
    ...overrides,
  };
}

describe("buildCalendarEvents", () => {
  it("turns an entry into a work event with real start/end dates", () => {
    const entry = makeEntry({
      startedAt: new Date(2026, 0, 7, 9, 0).toISOString(),
      endedAt: new Date(2026, 0, 7, 10, 30).toISOString(),
    });

    const events = buildCalendarEvents([entry]);

    expect(events).toEqual([
      {
        entryId: "te-1",
        start: new Date(2026, 0, 7, 9, 0),
        end: new Date(2026, 0, 7, 10, 30),
        kind: "work",
        projectColour: "blue",
        projectName: "Website",
        taskName: null,
        isRunning: false,
      },
    ]);
  });

  it("marks a still-running entry's event as running, ending at now", () => {
    const now = new Date(2026, 0, 5, 9, 30);
    const entry = makeEntry({
      startedAt: new Date(2026, 0, 5, 9, 0).toISOString(),
      endedAt: null,
      durationSeconds: null,
    });

    const events = buildCalendarEvents([entry], now);

    expect(events).toEqual([
      {
        entryId: "te-1",
        start: new Date(2026, 0, 5, 9, 0),
        end: now,
        kind: "work",
        projectColour: "blue",
        projectName: "Website",
        taskName: null,
        isRunning: true,
      },
    ]);
  });

  it("splits a paused entry into work/paused events", () => {
    const entry = makeEntry({
      startedAt: new Date(2026, 0, 6, 9, 0).toISOString(),
      endedAt: new Date(2026, 0, 6, 11, 0).toISOString(),
      pauses: [
        {
          pausedAt: new Date(2026, 0, 6, 9, 30).toISOString(),
          resumedAt: new Date(2026, 0, 6, 9, 45).toISOString(),
        },
      ],
    });

    const events = buildCalendarEvents([entry]);

    expect(events).toEqual([
      {
        entryId: "te-1",
        start: new Date(2026, 0, 6, 9, 0),
        end: new Date(2026, 0, 6, 9, 30),
        kind: "work",
        projectColour: "blue",
        projectName: "Website",
        taskName: null,
        isRunning: false,
      },
      {
        entryId: "te-1",
        start: new Date(2026, 0, 6, 9, 30),
        end: new Date(2026, 0, 6, 9, 45),
        kind: "paused",
        projectColour: "blue",
        projectName: "Website",
        taskName: null,
        isRunning: false,
      },
      {
        entryId: "te-1",
        start: new Date(2026, 0, 6, 9, 45),
        end: new Date(2026, 0, 6, 11, 0),
        kind: "work",
        projectColour: "blue",
        projectName: "Website",
        taskName: null,
        isRunning: false,
      },
    ]);
  });

  it("returns no events for an empty entry list", () => {
    expect(buildCalendarEvents([])).toEqual([]);
  });

  it("splits an entry that crosses midnight into one event per day", () => {
    const entry = makeEntry({
      startedAt: new Date(2026, 0, 5, 17, 11).toISOString(),
      endedAt: new Date(2026, 0, 6, 10, 1).toISOString(),
    });

    const events = buildCalendarEvents([entry]);

    expect(events).toEqual([
      {
        entryId: "te-1",
        start: new Date(2026, 0, 5, 17, 11),
        end: new Date(new Date(2026, 0, 6, 0, 0).getTime() - 1),
        kind: "work",
        projectColour: "blue",
        projectName: "Website",
        taskName: null,
        isRunning: false,
      },
      {
        entryId: "te-1",
        start: new Date(2026, 0, 6, 0, 0),
        end: new Date(2026, 0, 6, 10, 1),
        kind: "work",
        projectColour: "blue",
        projectName: "Website",
        taskName: null,
        isRunning: false,
      },
    ]);
  });

  it("nudges an entry that already ends exactly at midnight, not just ones split here", () => {
    const entry = makeEntry({
      startedAt: new Date(2026, 0, 5, 17, 11).toISOString(),
      endedAt: new Date(2026, 0, 6, 0, 0).toISOString(),
    });

    const events = buildCalendarEvents([entry]);

    expect(events).toEqual([
      {
        entryId: "te-1",
        start: new Date(2026, 0, 5, 17, 11),
        end: new Date(new Date(2026, 0, 6, 0, 0).getTime() - 1),
        kind: "work",
        projectColour: "blue",
        projectName: "Website",
        taskName: null,
        isRunning: false,
      },
    ]);
  });

  it("splits a still-running overnight entry, ending the last day's piece at now", () => {
    const now = new Date(2026, 0, 6, 9, 30);
    const entry = makeEntry({
      startedAt: new Date(2026, 0, 5, 22, 0).toISOString(),
      endedAt: null,
      durationSeconds: null,
    });

    const events = buildCalendarEvents([entry], now);

    expect(events).toEqual([
      {
        entryId: "te-1",
        start: new Date(2026, 0, 5, 22, 0),
        end: new Date(new Date(2026, 0, 6, 0, 0).getTime() - 1),
        kind: "work",
        projectColour: "blue",
        projectName: "Website",
        taskName: null,
        isRunning: true,
      },
      {
        entryId: "te-1",
        start: new Date(2026, 0, 6, 0, 0),
        end: now,
        kind: "work",
        projectColour: "blue",
        projectName: "Website",
        taskName: null,
        isRunning: true,
      },
    ]);
  });
});
