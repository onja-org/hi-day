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
    ...overrides,
  };
}

describe("groupEntriesBy", () => {
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

  it("groups entries without a task under 'No to-do'", () => {
    const groups = groupEntriesBy(
      [entry({ id: "a" }), entry({ id: "b", taskId: "t1", taskName: "Build" })],
      "todo",
    );
    expect(groups.map((g) => g.label).sort()).toEqual(["Build", "No to-do"]);
  });

  it("keeps every entry on its own for 'none'", () => {
    const groups = groupEntriesBy([entry({ id: "a" }), entry({ id: "b" })], "none");
    expect(groups).toHaveLength(2);
  });
});
