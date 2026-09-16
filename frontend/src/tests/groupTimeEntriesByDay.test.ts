import { describe, expect, it } from "vitest";
import { groupTimeEntriesByDay } from "@/lib/groupTimeEntriesByDay";
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

describe("groupTimeEntriesByDay", () => {
  it("groups entries that share a local calendar day", () => {
    const now = new Date(2026, 0, 5, 12, 0);
    const entries = [
      makeEntry({
        id: "te-1",
        startedAt: new Date(2026, 0, 5, 9, 0).toISOString(),
        endedAt: new Date(2026, 0, 5, 10, 0).toISOString(),
        durationSeconds: 3600,
      }),
      makeEntry({
        id: "te-2",
        startedAt: new Date(2026, 0, 5, 11, 0).toISOString(),
        endedAt: new Date(2026, 0, 5, 11, 30).toISOString(),
        durationSeconds: 1800,
      }),
    ];

    const groups = groupTimeEntriesByDay(entries, now);

    expect(groups).toHaveLength(1);
    expect(groups[0].entries).toHaveLength(2);
    expect(groups[0].totalSeconds).toBe(5400);
    expect(groups[0].label).toBe("Today");
  });

  it("keeps different days as separate groups, in first-seen order", () => {
    const now = new Date(2026, 0, 5, 12, 0);
    const entries = [
      makeEntry({ id: "te-today", startedAt: new Date(2026, 0, 5, 9, 0).toISOString() }),
      makeEntry({ id: "te-yesterday", startedAt: new Date(2026, 0, 4, 9, 0).toISOString() }),
    ];

    const groups = groupTimeEntriesByDay(entries, now);

    expect(groups.map((g) => g.label)).toEqual(["Today", "Yesterday"]);
  });

  it("excludes a still-running entry from the day's total", () => {
    const now = new Date(2026, 0, 5, 12, 0);
    const entries = [
      makeEntry({
        id: "te-running",
        startedAt: new Date(2026, 0, 5, 11, 0).toISOString(),
        endedAt: null,
        durationSeconds: null,
      }),
    ];

    const groups = groupTimeEntriesByDay(entries, now);

    expect(groups[0].totalSeconds).toBe(0);
  });

  it("labels a day further back with a formatted date, not Today/Yesterday", () => {
    const now = new Date(2026, 0, 10, 12, 0);
    const entries = [makeEntry({ startedAt: new Date(2026, 0, 1, 9, 0).toISOString() })];

    const groups = groupTimeEntriesByDay(entries, now);

    expect(groups[0].label).not.toBe("Today");
    expect(groups[0].label).not.toBe("Yesterday");
    expect(groups[0].label).toContain("Jan");
  });

  it("returns an empty array for no entries", () => {
    expect(groupTimeEntriesByDay([])).toEqual([]);
  });
});
