import { describe, expect, it } from "vitest";
import { buildTimeActivityRows, totalEntrySeconds } from "@/lib/buildTimeActivityRows";
import type { TimeEntryListItem } from "@/types/timeEntry";

function entry(overrides: Partial<TimeEntryListItem>): TimeEntryListItem {
  return {
    id: "e1",
    membershipId: "m1",
    projectId: "p1",
    taskId: null,
    startedAt: "2026-09-28T09:00:00",
    endedAt: "2026-09-28T10:00:00",
    source: "web",
    deviceId: null,
    pausedAt: null,
    pausedSeconds: 0,
    projectName: "Alpha",
    projectColour: "blue",
    taskName: null,
    durationSeconds: 3600,
    memberName: null,
    memberEmail: null,
    canEdit: false,
    canDelete: false,
    pauses: [],
    ...overrides,
  };
}

describe("buildTimeActivityRows", () => {
  it("groups entries into one expandable row per day", () => {
    const rows = buildTimeActivityRows([
      entry({ id: "a" }),
      entry({ id: "b", startedAt: "2026-09-28T11:00:00", endedAt: "2026-09-28T11:30:00", durationSeconds: 1800 }),
      entry({ id: "c", startedAt: "2026-09-29T09:00:00", endedAt: "2026-09-29T10:00:00" }),
    ], "day");
    expect(rows).toHaveLength(2);
    expect(rows[0].subRows).toHaveLength(2);
    expect(String(rows[0].cells.date)).toMatch(/\(2\)$/);
  });

  it("splits manual time from tracked time but counts both in the total", () => {
    const [row] = buildTimeActivityRows([
      entry({ id: "a", durationSeconds: 3600 }),
      entry({ id: "b", source: "manual", durationSeconds: 1800 }),
    ], "day");
    expect(row.cells.regular).toBe("01:00:00");
    expect(row.cells.manual).toBe("00:30:00");
    expect(row.cells.total).toBe("01:30:00");
  });

  it("lists each distinct project once on the day row", () => {
    const [row] = buildTimeActivityRows([
      entry({ id: "a" }),
      entry({ id: "b", startedAt: "2026-09-28T12:00:00" }),
      entry({ id: "c", startedAt: "2026-09-28T13:00:00", projectName: "Beta" }),
    ], "day");
    expect(row.cells.project).toBe("Alpha, Beta");
  });

  it("names the member on each row, falling back to email", () => {
    const [row] = buildTimeActivityRows([
      entry({ id: "a", memberName: "Ada" }),
      entry({ id: "b", memberEmail: "bob@example.com" }),
    ], "day");
    expect(row.cells.member).toBe("Ada, bob@example.com");
    expect(row.subRows?.[0].cells.member).toBeDefined();
  });

  it("sums paused seconds into break time", () => {
    const [row] = buildTimeActivityRows([entry({ pausedSeconds: 90 })], "day");
    expect(row.cells.breakTime).toBe("00:01:30");
  });
});

describe("buildTimeActivityRows grouping", () => {
  it("makes flat rows without sub-rows for 'none'", () => {
    const rows = buildTimeActivityRows([entry({ id: "a" }), entry({ id: "b" })], "none");
    expect(rows).toHaveLength(2);
    expect(rows[0].subRows).toBeUndefined();
  });

  it("labels project groups by project name with an entry count", () => {
    const [row] = buildTimeActivityRows([entry({ id: "a" })], "project");
    expect(row.cells.date).toBe("Alpha (1)");
  });
});

describe("totalEntrySeconds", () => {
  it("adds up every entry's seconds", () => {
    expect(totalEntrySeconds([entry({ durationSeconds: 60 }), entry({ id: "b", durationSeconds: 30 })])).toBe(90);
  });

  it("is zero for no entries", () => {
    expect(totalEntrySeconds([])).toBe(0);
  });
});
