import { describe, expect, it } from "vitest";
import { buildProjectDayMatrix } from "@/lib/buildProjectDayMatrix";
import type { TimeEntryListItem } from "@/types/timeEntry";

/**
 * `endedAt` is derived from `startedAt` and `durationSeconds` unless given
 * outright: totals now read an entry's timestamps, not only its duration, so
 * an entry whose end contradicts its start is no longer harmless fixture
 * noise.
 */
function makeEntry(overrides: Partial<TimeEntryListItem> = {}): TimeEntryListItem {
  const startedAt = overrides.startedAt ?? "2026-01-05T09:00:00.000Z";
  const durationSeconds =
    overrides.durationSeconds !== undefined ? overrides.durationSeconds : 3600;
  const endedAt =
    "endedAt" in overrides
      ? (overrides.endedAt ?? null)
      : durationSeconds === null
        ? null
        : new Date(Date.parse(startedAt) + durationSeconds * 1000).toISOString();

  return {
    ...baseEntry(),
    ...overrides,
    startedAt,
    endedAt,
    durationSeconds,
  };
}

function baseEntry(): TimeEntryListItem {
  return {
    id: `entry-${Math.random()}`,
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
  };
}

describe("buildProjectDayMatrix", () => {
  const weekStart = new Date(2026, 0, 5, 0, 0, 0, 0); // Monday

  it("sums per-project seconds into the correct day-of-week column", () => {
    const entries = [
      makeEntry({
        projectId: "p-1",
        projectName: "Website",
        startedAt: new Date(2026, 0, 5, 9, 0).toISOString(), // Monday
        durationSeconds: 3600,
      }),
      makeEntry({
        projectId: "p-1",
        projectName: "Website",
        startedAt: new Date(2026, 0, 7, 9, 0).toISOString(), // Wednesday
        durationSeconds: 1800,
      }),
      makeEntry({
        projectId: "p-2",
        projectName: "Mobile app",
        projectColour: "green",
        startedAt: new Date(2026, 0, 5, 14, 0).toISOString(), // Monday
        durationSeconds: 900,
      }),
    ];

    const matrix = buildProjectDayMatrix(entries, weekStart);

    expect(matrix.rows).toEqual([
      {
        projectId: "p-1",
        projectName: "Website",
        projectColour: "blue",
        dailySeconds: [3600, 0, 1800, 0, 0, 0, 0],
        totalSeconds: 5400,
      },
      {
        projectId: "p-2",
        projectName: "Mobile app",
        projectColour: "green",
        dailySeconds: [900, 0, 0, 0, 0, 0, 0],
        totalSeconds: 900,
      },
    ]);
    expect(matrix.dailyTotals).toEqual([4500, 0, 1800, 0, 0, 0, 0]);
    expect(matrix.grandTotal).toBe(6300);
  });

  it("excludes a still-running entry from every total", () => {
    const entries = [
      makeEntry({ endedAt: null, durationSeconds: null }),
    ];

    const matrix = buildProjectDayMatrix(entries, weekStart);

    expect(matrix.rows).toEqual([]);
    expect(matrix.grandTotal).toBe(0);
  });

  it("ignores an entry that falls outside the requested week", () => {
    const entries = [
      makeEntry({ startedAt: new Date(2026, 0, 20, 9, 0).toISOString() }),
    ];

    const matrix = buildProjectDayMatrix(entries, weekStart);

    expect(matrix.rows).toEqual([]);
  });
});
