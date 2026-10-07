import { describe, expect, it } from "vitest";
import { buildWorkSessionsRows } from "@/lib/buildWorkSessionsRows";
import type { TimeEntryListItem } from "@/types/timeEntry";

function entry(overrides: Partial<TimeEntryListItem>): TimeEntryListItem {
  return {
    id: "e1",
    membershipId: "m1",
    projectId: "p1",
    taskId: null,
    startedAt: "2026-10-05T09:00:00.000Z",
    endedAt: "2026-10-05T10:00:00.000Z",
    source: "web",
    deviceId: null,
    pausedAt: null,
    pausedSeconds: 0,
    projectName: "Website",
    projectColour: "blue",
    taskName: null,
    durationSeconds: 3600,
    memberName: "Ana",
    memberEmail: "ana@example.com",
    type: "normal",
    activePercentage: null,
    canEdit: false,
    canDelete: false,
    pauses: [],
    ...overrides,
  };
}

describe("buildWorkSessionsRows", () => {
  const entries = [
    entry({ id: "late", startedAt: "2026-10-05T13:00:00.000Z", endedAt: "2026-10-05T13:30:00.000Z", durationSeconds: 1800 }),
    entry({ id: "early" }),
    entry({ id: "next", startedAt: "2026-10-06T09:00:00.000Z", endedAt: null, durationSeconds: null }),
  ];

  it("groups sessions by day, summing finished ones and counting all", () => {
    const rows = buildWorkSessionsRows(entries, "day", "UTC");
    expect(rows).toHaveLength(2);
    expect(rows[0].cells.group).toMatch(/\(2\)$/);
    expect(rows[0].cells.duration).toBe("01:30:00");
    expect(rows[1].cells.duration).toBe("00:00:00");
  });

  it("lists a day's sessions in the order they started, unmerged", () => {
    const [first] = buildWorkSessionsRows(entries, "day", "UTC");
    expect(first.subRows?.map((row) => row.id)).toEqual(["early", "late"]);
  });

  it("groups by project or member across days, keeping the date on each session", () => {
    const other = entry({ id: "other", projectId: "p2", projectName: "App", memberName: "Ben", membershipId: "m2" });
    const byProject = buildWorkSessionsRows([...entries, other], "project", "UTC");
    expect(byProject.map((row) => row.cells.group)).toEqual(["App (1)", "Website (3)"]);
    expect(byProject[1].subRows?.map((row) => row.id)).toEqual(["early", "late", "next"]);
    expect(byProject[1].subRows?.[0].cells.day).toEqual(expect.any(String));

    const byMember = buildWorkSessionsRows([...entries, other], "member", "UTC");
    expect(byMember.map((row) => row.cells.group)).toEqual(["Ana (3)", "Ben (1)"]);
  });

  it("shows a running session as in progress and flags manual ones", () => {
    const rows = buildWorkSessionsRows(
      [entry({ endedAt: null, durationSeconds: null, source: "manual" })],
      "day",
      "UTC",
    );
    expect(rows[0].subRows?.[0].cells).toMatchObject({ stopped: "In progress", duration: "-", manual: "Yes" });
  });
});
