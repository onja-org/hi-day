import { describe, expect, it } from "vitest";
import { findOverlappingEntry } from "@/lib/findOverlappingEntry";
import type { TimeEntryListItem } from "@/types/timeEntry";

const NOW = new Date("2026-01-05T18:00");

function entry(
  overrides: Partial<TimeEntryListItem> & { id: string },
): TimeEntryListItem {
  return {
    membershipId: "m-1",
    projectId: "p-1",
    taskId: null,
    startedAt: "2026-01-05T09:00",
    endedAt: "2026-01-05T10:00",
    source: "manual",
    deviceId: null,
    pausedAt: null,
    pausedSeconds: 0,
    projectName: "Project One",
    projectColour: "blue",
    taskName: null,
    durationSeconds: 3600,
    memberName: null,
    memberEmail: null,
    type: "manual",
    activePercentage: null,
    canEdit: true,
    canDelete: true,
    pauses: [],
    ...overrides,
  } as TimeEntryListItem;
}

const nineToTen = entry({ id: "e-1" });

function search(startedAt: string, endedAt: string, extra = {}) {
  return findOverlappingEntry({
    entries: [nineToTen],
    membershipId: "m-1",
    startedAt,
    endedAt,
    now: NOW,
    ...extra,
  });
}

describe("findOverlappingEntry", () => {
  it("finds an entry the new times sit inside", () => {
    expect(search("2026-01-05T09:15", "2026-01-05T09:45")?.id).toBe("e-1");
  });

  it("finds one the new times straddle", () => {
    expect(search("2026-01-05T08:00", "2026-01-05T11:00")?.id).toBe("e-1");
  });

  it("finds one the new times run into at either end", () => {
    expect(search("2026-01-05T08:30", "2026-01-05T09:30")?.id).toBe("e-1");
    expect(search("2026-01-05T09:30", "2026-01-05T10:30")?.id).toBe("e-1");
  });

  it("leaves a clear stretch alone", () => {
    expect(search("2026-01-05T11:00", "2026-01-05T12:00")).toBeNull();
  });

  // One entry ending as the next begins is an ordinary handover, not a clash.
  it("allows times that only touch at an endpoint", () => {
    expect(search("2026-01-05T10:00", "2026-01-05T11:00")).toBeNull();
    expect(search("2026-01-05T08:00", "2026-01-05T09:00")).toBeNull();
  });

  it("never reports the entry being edited against itself", () => {
    expect(search("2026-01-05T09:15", "2026-01-05T09:45", { excludeId: "e-1" })).toBeNull();
  });

  // An admin's timesheet lists several people at once.
  it("ignores another person's entry", () => {
    expect(
      search("2026-01-05T09:15", "2026-01-05T09:45", { membershipId: "m-2" }),
    ).toBeNull();
  });

  /**
   * A running entry has no end yet but still occupies the time up to now —
   * the stretch someone is most likely to double-book by hand.
   */
  it("treats a running entry as occupying time up to now", () => {
    const running = [entry({ id: "e-2", startedAt: "2026-01-05T17:00", endedAt: null })];

    expect(
      findOverlappingEntry({
        entries: running,
        startedAt: "2026-01-05T17:30",
        endedAt: "2026-01-05T17:45",
        now: NOW,
      })?.id,
    ).toBe("e-2");
    expect(
      findOverlappingEntry({
        entries: running,
        startedAt: "2026-01-05T15:00",
        endedAt: "2026-01-05T16:00",
        now: NOW,
      }),
    ).toBeNull();
  });

  // Half-typed times are not a clash to report — the field is mid-edit.
  it("says nothing about incomplete or backwards times", () => {
    expect(search("", "2026-01-05T09:45")).toBeNull();
    expect(search("2026-01-05T09:45", "")).toBeNull();
    expect(search("2026-01-05T09:45", "2026-01-05T09:15")).toBeNull();
  });
});
