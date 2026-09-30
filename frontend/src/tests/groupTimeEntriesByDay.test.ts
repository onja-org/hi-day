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

describe("groupTimeEntriesByDay", () => {
  it("groups entries that share a local calendar day", () => {
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

    const groups = groupTimeEntriesByDay(entries);

    expect(groups).toHaveLength(1);
    expect(groups[0].entries).toHaveLength(2);
    expect(groups[0].totalSeconds).toBe(5400);
  });

  it("keeps different days as separate groups, in first-seen order", () => {
    const entries = [
      makeEntry({ id: "te-later", startedAt: new Date(2026, 0, 5, 9, 0).toISOString() }),
      makeEntry({ id: "te-earlier", startedAt: new Date(2026, 0, 4, 9, 0).toISOString() }),
    ];

    const groups = groupTimeEntriesByDay(entries);

    expect(groups.map((g) => g.dateKey)).toEqual(["2026-01-05", "2026-01-04"]);
  });

  // With no clock reading there is nothing to measure a running entry
  // against — server rendering is exactly that case.
  it("counts a still-running entry as nothing when given no clock", () => {
    const entries = [
      makeEntry({
        id: "te-running",
        startedAt: new Date(2026, 0, 5, 11, 0).toISOString(),
        endedAt: null,
        durationSeconds: null,
      }),
    ];

    expect(groupTimeEntriesByDay(entries)[0].totalSeconds).toBe(0);
  });

  it("counts what a still-running entry has accrued when given a clock", () => {
    const entries = [
      makeEntry({
        id: "te-running",
        startedAt: new Date(2026, 0, 5, 11, 0).toISOString(),
        endedAt: null,
        durationSeconds: null,
      }),
    ];

    const groups = groupTimeEntriesByDay(entries, new Date(2026, 0, 5, 12, 0));

    expect(groups[0].totalSeconds).toBe(3600);
  });

  it("labels the current day Today", () => {
    const entries = [makeEntry({ startedAt: new Date().toISOString() })];

    expect(groupTimeEntriesByDay(entries)[0].label).toBe("Today");
  });

  // Only the current day is unmistakable without knowing today's date —
  // "Yesterday" goes stale the moment a timesheet is exported or
  // screenshotted, so every other day gets a real one.
  it("dates the day before rather than calling it Yesterday", () => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const entries = [makeEntry({ startedAt: yesterday.toISOString() })];

    const [group] = groupTimeEntriesByDay(entries);

    expect(group.label).not.toBe("Yesterday");
    expect(group.label).toContain(String(yesterday.getFullYear()));
  });

  it("spells out the year, so an exported timesheet stays unambiguous", () => {
    const entries = [makeEntry({ startedAt: new Date(2026, 0, 1, 9, 0).toISOString() })];

    expect(groupTimeEntriesByDay(entries)[0].label).toContain("2026");
  });

  it("returns an empty array for no entries", () => {
    expect(groupTimeEntriesByDay([])).toEqual([]);
  });
});
