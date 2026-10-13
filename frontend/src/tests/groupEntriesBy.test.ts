import { describe, expect, it } from "vitest";
import { groupEntriesBy } from "@/lib/groupEntriesBy";
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
    memberName: "Ada",
    memberEmail: null,
    canEdit: false,
    canDelete: false,
    pauses: [],
    type: "normal",
    activePercentage: null,
    ...overrides,
  };
}

describe("groupEntriesBy", () => {
  it("reads days and weeks in the given zone", () => {
    // 22:30 UTC on Sunday 27 Sep is Monday 28 Sep in Nairobi.
    const late = entry({ startedAt: "2026-09-27T22:30:00Z" });
    expect(groupEntriesBy([late], "day", new Map(), "monday", "Africa/Nairobi")[0].id).toBe("2026-09-28");
    expect(groupEntriesBy([late], "week", new Map(), "monday", "Africa/Nairobi")[0].id).toBe("2026-09-28");
    expect(groupEntriesBy([late], "week", new Map(), "monday", "UTC")[0].id).toBe("2026-09-21");
  });

  it("puts entries from the same Monday–Sunday week in one group", () => {
    const groups = groupEntriesBy(
      [
        entry({ id: "a", startedAt: "2026-09-28T09:00:00" }),
        entry({ id: "b", startedAt: "2026-10-04T09:00:00" }),
        entry({ id: "c", startedAt: "2026-10-05T09:00:00" }),
      ],
      "week",
    );
    expect(groups.map((g) => g.entries.length)).toEqual([2, 1]);
  });

  it("splits a Sunday-start week differently, with Oct 4 opening a week instead of closing one", () => {
    const entries = [
      entry({ id: "a", startedAt: "2026-09-28T09:00:00" }),
      entry({ id: "b", startedAt: "2026-10-04T09:00:00" }),
      entry({ id: "c", startedAt: "2026-10-05T09:00:00" }),
    ];

    expect(
      groupEntriesBy(entries, "week", new Map(), "sunday").map((group) => group.entries.length),
    ).toEqual([1, 2]);
  });

  it("groups by project, alphabetically", () => {
    const groups = groupEntriesBy(
      [
        entry({ id: "a", projectId: "p2", projectName: "Beta" }),
        entry({ id: "b", projectId: "p1", projectName: "Alpha" }),
        entry({ id: "c", projectId: "p2", projectName: "Beta" }),
      ],
      "project",
    );
    expect(groups.map((g) => [g.label, g.entries.length])).toEqual([
      ["Alpha", 1],
      ["Beta", 2],
    ]);
  });

  it("groups by member", () => {
    const groups = groupEntriesBy(
      [entry({ id: "a" }), entry({ id: "b", membershipId: "m2", memberName: "Bob" })],
      "member",
    );
    expect(groups.map((g) => g.label)).toEqual(["Ada", "Bob"]);
  });

  it("puts an entry in every team its member belongs to", () => {
    const groups = groupEntriesBy([entry({ id: "a" })], "team", new Map([["m1", ["Dev", "Design"]]]));
    expect(groups.map((g) => g.label)).toEqual(["Design", "Dev"]);
  });

  it("uses 'No team' for a member with no teams", () => {
    expect(groupEntriesBy([entry({ id: "a" })], "team", new Map())[0].label).toBe("No team");
  });

  it("keeps every entry on its own for 'none'", () => {
    const groups = groupEntriesBy([entry({ id: "a" }), entry({ id: "b" })], "none");
    expect(groups).toHaveLength(2);
  });
});
