import { describe, expect, it } from "vitest";
import { splitEntryIntoSegments } from "@/lib/splitEntryIntoSegments";
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

describe("splitEntryIntoSegments", () => {
  it("returns one work segment for an entry with no pauses", () => {
    const entry = makeEntry();

    const segments = splitEntryIntoSegments(entry);

    expect(segments).toEqual([
      {
        startedAt: new Date("2026-01-05T09:00:00.000Z"),
        endedAt: new Date("2026-01-05T10:00:00.000Z"),
        kind: "work",
      },
    ]);
  });

  it("splits work/paused/work around one closed pause", () => {
    const entry = makeEntry({
      startedAt: "2026-01-05T09:00:00.000Z",
      endedAt: "2026-01-05T11:00:00.000Z",
      pauses: [{ pausedAt: "2026-01-05T09:30:00.000Z", resumedAt: "2026-01-05T09:45:00.000Z" }],
    });

    const segments = splitEntryIntoSegments(entry);

    expect(segments).toEqual([
      {
        startedAt: new Date("2026-01-05T09:00:00.000Z"),
        endedAt: new Date("2026-01-05T09:30:00.000Z"),
        kind: "work",
      },
      {
        startedAt: new Date("2026-01-05T09:30:00.000Z"),
        endedAt: new Date("2026-01-05T09:45:00.000Z"),
        kind: "paused",
      },
      {
        startedAt: new Date("2026-01-05T09:45:00.000Z"),
        endedAt: new Date("2026-01-05T11:00:00.000Z"),
        kind: "work",
      },
    ]);
  });

  it("closes a still-open pause at `now` and stops there", () => {
    const entry = makeEntry({
      startedAt: "2026-01-05T09:00:00.000Z",
      endedAt: null,
      durationSeconds: null,
      pausedAt: "2026-01-05T09:30:00.000Z",
      pauses: [{ pausedAt: "2026-01-05T09:30:00.000Z", resumedAt: null }],
    });
    const now = new Date("2026-01-05T09:40:00.000Z");

    const segments = splitEntryIntoSegments(entry, now);

    expect(segments).toEqual([
      {
        startedAt: new Date("2026-01-05T09:00:00.000Z"),
        endedAt: new Date("2026-01-05T09:30:00.000Z"),
        kind: "work",
      },
      {
        startedAt: new Date("2026-01-05T09:30:00.000Z"),
        endedAt: now,
        kind: "paused",
      },
    ]);
  });

  it("closes a still-running, never-paused entry at `now`", () => {
    const entry = makeEntry({
      startedAt: "2026-01-05T09:00:00.000Z",
      endedAt: null,
      durationSeconds: null,
    });
    const now = new Date("2026-01-05T09:15:00.000Z");

    const segments = splitEntryIntoSegments(entry, now);

    expect(segments).toEqual([
      { startedAt: new Date("2026-01-05T09:00:00.000Z"), endedAt: now, kind: "work" },
    ]);
  });
});
