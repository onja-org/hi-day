import { describe, expect, it } from "vitest";
import { buildTimeActivityChartRows } from "@/lib/buildTimeActivityChartRows";
import type { TimeEntryListItem } from "@/types/timeEntry";

function entry(id: string, startedAt: string, source: "web" | "manual", durationSeconds: number): TimeEntryListItem {
  return {
    id,
    membershipId: "m1",
    projectId: "p1",
    taskId: null,
    startedAt,
    endedAt: startedAt,
    source,
    deviceId: null,
    pausedAt: null,
    pausedSeconds: 0,
    projectName: "Alpha",
    projectColour: "blue",
    taskName: null,
    durationSeconds,
    memberName: null,
    memberEmail: null,
    canEdit: false,
    canDelete: false,
    pauses: [],
  };
}

describe("buildTimeActivityChartRows", () => {
  it("orders days oldest first", () => {
    const rows = buildTimeActivityChartRows([
      entry("b", "2026-09-29T09:00:00", "web", 60),
      entry("a", "2026-09-28T09:00:00", "web", 60),
    ], "day");
    expect(rows.map((r) => r.label)).toEqual([expect.stringContaining("28"), expect.stringContaining("29")]);
  });

  it("splits a day into tracked and manual seconds", () => {
    const [row] = buildTimeActivityChartRows([
      entry("a", "2026-09-28T09:00:00", "web", 100),
      entry("b", "2026-09-28T10:00:00", "manual", 40),
    ], "day");
    expect(row.values).toEqual({ tracked: 100, manual: 40 });
  });

  it("returns nothing for no entries", () => {
    expect(buildTimeActivityChartRows([], "day")).toEqual([]);
  });
});
