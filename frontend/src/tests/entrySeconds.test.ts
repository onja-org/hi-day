import { describe, expect, it } from "vitest";
import { entrySeconds } from "@/lib/entrySeconds";
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

const NOW = new Date("2026-01-05T10:30:00.000Z");

describe("entrySeconds", () => {
  it("uses the settled duration of a completed entry", () => {
    expect(entrySeconds(makeEntry(), NOW)).toBe(3600);
  });

  it("counts what a running entry has accrued so far", () => {
    const running = makeEntry({ endedAt: null, durationSeconds: null });

    expect(entrySeconds(running, NOW)).toBe(5400);
  });

  it("counts a paused entry up to the pause, even with no clock reading", () => {
    const paused = makeEntry({
      endedAt: null,
      durationSeconds: null,
      pausedAt: "2026-01-05T09:30:00.000Z",
    });

    expect(entrySeconds(paused, null)).toBe(1800);
  });

  // Server render and first paint have no clock — a running entry simply
  // contributes nothing until one arrives, rather than guessing.
  it("contributes nothing for a ticking entry with no clock reading", () => {
    const running = makeEntry({ endedAt: null, durationSeconds: null });

    expect(entrySeconds(running, null)).toBe(0);
  });
});
