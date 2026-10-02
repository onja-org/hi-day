import { describe, expect, it } from "vitest";
import { attributeProjectSeconds } from "@/lib/attributeProjectSeconds";
import { unionActiveSeconds } from "@/lib/unionActiveSeconds";
import type { TimeEntryListItem } from "@/types/timeEntry";

function makeEntry(overrides: Partial<TimeEntryListItem> = {}): TimeEntryListItem {
  const startedAt = overrides.startedAt ?? "2026-01-05T09:00:00.000Z";
  const endedAt = overrides.endedAt ?? "2026-01-05T10:00:00.000Z";
  return {
    id: "te-1",
    membershipId: "m-1",
    projectId: "p-1",
    projectName: "Website",
    projectColour: "blue",
    taskId: null,
    taskName: null,
    startedAt,
    endedAt,
    source: "agent",
    deviceId: "device-a",
    pausedAt: null,
    pausedSeconds: 0,
    durationSeconds:
      endedAt === null
        ? null
        : (Date.parse(endedAt) - Date.parse(startedAt)) / 1000,
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

const HOUR = 3600;

describe("attributeProjectSeconds", () => {
  it("leaves projects that never overlap exactly as they were tracked", () => {
    const seconds = attributeProjectSeconds([
      makeEntry({ id: "a", projectId: "x", startedAt: "2026-01-05T09:00:00.000Z", endedAt: "2026-01-05T13:00:00.000Z" }),
      makeEntry({ id: "b", projectId: "y", startedAt: "2026-01-05T13:00:00.000Z", endedAt: "2026-01-05T17:00:00.000Z" }),
    ]);

    expect(seconds.get("x")).toBe(4 * HOUR);
    expect(seconds.get("y")).toBe(4 * HOUR);
  });

  // Day A: two machines, two projects, the whole day in parallel.
  it("gives a fully shared day to one project rather than both", () => {
    const seconds = attributeProjectSeconds([
      makeEntry({ id: "a", projectId: "x", deviceId: "device-a", startedAt: "2026-01-05T09:00:00.000Z", endedAt: "2026-01-05T17:00:00.000Z" }),
      makeEntry({ id: "b", projectId: "y", deviceId: "device-b", startedAt: "2026-01-05T09:00:00.000Z", endedAt: "2026-01-05T17:00:00.000Z" }),
    ]);

    expect([...seconds.values()].reduce((a, b) => a + b, 0)).toBe(8 * HOUR);
  });

  // Day B: one minute of overlap must cost one minute, not an afternoon.
  it("charges a one-minute overlap one minute", () => {
    const entries = [
      makeEntry({ id: "a", projectId: "x", deviceId: "device-a", startedAt: "2026-01-05T09:00:00.000Z", endedAt: "2026-01-05T13:00:00.000Z" }),
      makeEntry({ id: "b", projectId: "y", deviceId: "device-b", startedAt: "2026-01-05T12:59:00.000Z", endedAt: "2026-01-05T17:00:00.000Z" }),
    ];
    const seconds = attributeProjectSeconds(entries);

    // Y is longer (4h 1m), so it keeps the shared minute and X gives it up.
    expect(seconds.get("y")).toBe(4 * HOUR + 60);
    expect(seconds.get("x")).toBe(4 * HOUR - 60);
    expect([...seconds.values()].reduce((a, b) => a + b, 0)).toBe(8 * HOUR);
  });

  it("always sums to the unioned total of the same entries", () => {
    const entries = [
      makeEntry({ id: "a", projectId: "x", startedAt: "2026-01-05T09:00:00.000Z", endedAt: "2026-01-05T11:00:00.000Z" }),
      makeEntry({ id: "b", projectId: "y", startedAt: "2026-01-05T10:00:00.000Z", endedAt: "2026-01-05T12:30:00.000Z" }),
      makeEntry({ id: "c", projectId: "z", startedAt: "2026-01-05T14:00:00.000Z", endedAt: "2026-01-05T15:00:00.000Z" }),
    ];
    const attributed = [...attributeProjectSeconds(entries).values()].reduce(
      (a, b) => a + b,
      0,
    );

    expect(attributed).toBe(unionActiveSeconds(entries));
  });

  it("breaks a tie by whichever project started first", () => {
    const seconds = attributeProjectSeconds([
      makeEntry({ id: "a", projectId: "later", startedAt: "2026-01-05T09:30:00.000Z", endedAt: "2026-01-05T10:30:00.000Z" }),
      makeEntry({ id: "b", projectId: "earlier", startedAt: "2026-01-05T09:00:00.000Z", endedAt: "2026-01-05T10:00:00.000Z" }),
    ]);

    // Both tracked an hour, so the earlier start keeps the shared half-hour.
    expect(seconds.get("earlier")).toBe(HOUR);
    expect(seconds.get("later")).toBe(1800);
  });

  it("excludes a pause from the time a project is credited with", () => {
    const seconds = attributeProjectSeconds([
      makeEntry({
        id: "a",
        projectId: "x",
        startedAt: "2026-01-05T09:00:00.000Z",
        endedAt: "2026-01-05T11:00:00.000Z",
        pauses: [
          {
            pausedAt: "2026-01-05T09:30:00.000Z",
            resumedAt: "2026-01-05T10:00:00.000Z",
          },
        ],
      }),
    ]);

    expect(seconds.get("x")).toBe(90 * 60);
  });

  it("returns nothing for no entries", () => {
    expect(attributeProjectSeconds([]).size).toBe(0);
  });
});
