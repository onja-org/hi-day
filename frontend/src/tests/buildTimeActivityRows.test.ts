import { describe, expect, it } from "vitest";
import { buildTimeActivityRows, totalEntrySeconds } from "@/lib/buildTimeActivityRows";
import type { TimeActivityGrouping } from "@/types/timeActivityGrouping";
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

const build = (
  entries: TimeEntryListItem[],
  grouping: TimeActivityGrouping,
  options: {
    sumDates?: boolean;
    teamNames?: Map<string, string[]>;
    idleMembers?: { id: string; label: string }[];
  } = {},
) =>
  buildTimeActivityRows(entries, grouping, {
    sumDates: options.sumDates ?? false,
    teamNames: options.teamNames ?? new Map(),
    idleMembers: options.idleMembers,
  });

describe("buildTimeActivityRows", () => {
  it("day grouping: one row per day, expanding straight to rows named by member", () => {
    const rows = build(
      [entry({ id: "a" }), entry({ id: "b", startedAt: "2026-09-28T11:00:00", projectId: "p2", projectName: "Beta" }), entry({ id: "c", startedAt: "2026-09-29T09:00:00" })],
      "day",
    );
    expect(rows).toHaveLength(2);
    expect(String(rows[0].cells.date)).toMatch(/\(2\)$/);
    expect(rows[0].subRows?.map((r) => r.cells.date)).toEqual(["Ada", "Ada"]);
    expect(rows[0].subRows?.[0].subRows).toBeUndefined();
  });

  it("merges several sessions by the same member on the same project into one row", () => {
    const [row] = build(
      [
        entry({ id: "a", durationSeconds: 60 }),
        entry({ id: "b", startedAt: "2026-09-28T11:00:00", durationSeconds: 120 }),
        entry({ id: "c", startedAt: "2026-09-28T13:00:00", durationSeconds: 30 }),
      ],
      "day",
    );
    expect(row.cells.date).toMatch(/\(1\)$/);
    expect(row.subRows).toHaveLength(1);
    expect(row.subRows?.[0].cells.total).toBe("00:03:30");
  });

  it("under a team group, only that team's row appears", () => {
    const rows = build([entry({ id: "a" })], "team", {
      sumDates: true,
      teamNames: new Map([["m1", ["Dev", "Design"]]]),
    });
    const dev = rows.find((r) => String(r.cells.date).startsWith("Dev"));
    expect(dev?.subRows?.map((r) => r.cells.team)).toEqual(["Dev"]);
  });

  it("gives a member on two teams one row, listing both teams", () => {
    const [row] = build([entry({ id: "a" })], "day", { teamNames: new Map([["m1", ["Dev", "Design"]]]) });
    expect(row.subRows).toHaveLength(1);
    expect(row.subRows?.[0].cells.team).toBe("Dev, Design");
    expect(row.cells.date).toMatch(/\(1\)$/);
  });

  it("keeps different members on the same project as separate rows", () => {
    const [row] = build([entry({ id: "a" }), entry({ id: "b", membershipId: "m2", memberName: "Bob" })], "day");
    expect(row.subRows?.map((r) => r.cells.date)).toEqual(["Ada", "Bob"]);
  });

  it("week grouping: entries sit directly under the week", () => {
    const [row] = build([entry({ id: "a" }), entry({ id: "b", startedAt: "2026-10-02T09:00:00" })], "week");
    expect(row.subRows).toHaveLength(2);
    expect(row.cells.date).toMatch(/\(2\)$/);
  });

  it("project grouping: project → day → entry", () => {
    const [row] = build([entry({ id: "a" })], "project");
    expect(row.cells.date).toBe("Alpha (1)");
    expect(row.subRows).toHaveLength(1);
    expect(row.subRows?.[0].subRows).toHaveLength(1);
  });

  it("'sum dates' drops the day level under a project", () => {
    const [row] = build([entry({ id: "a" })], "project", { sumDates: true });
    expect(row.subRows?.[0].subRows).toBeUndefined();
    expect(row.subRows?.[0].cells.date).toBe("Ada");
  });

  it("member grouping: entries show their project, since the group already names the member", () => {
    const [row] = build([entry({ id: "a" })], "member", { sumDates: true });
    expect(row.subRows?.[0].cells.date).toBe("Alpha");
  });

  it("team grouping counts a member on two teams in both", () => {
    const rows = build([entry({ id: "a" })], "team", { teamNames: new Map([["m1", ["Dev", "Design"]]]) });
    expect(rows.map((r) => r.cells.date)).toEqual(["Design (1)", "Dev (1)"]);
    expect(rows[0].subRows?.[0].id).not.toBe(rows[1].subRows?.[0].id);
  });

  it("none: a flat row per entry with its day in a separate cell", () => {
    const rows = build([entry({ id: "a" }), entry({ id: "b", startedAt: "2026-09-29T09:00:00" })], "none");
    expect(rows).toHaveLength(2);
    expect(rows[0].subRows).toBeUndefined();
    expect(rows[0].cells.date).toBe("Ada");
    expect(String(rows[0].cells.when)).toContain("2026");
  });

  it("splits manual time from tracked time but counts both in the total", () => {
    const [row] = build([entry({ id: "a", durationSeconds: 3600 }), entry({ id: "b", source: "manual", durationSeconds: 1800 })], "day");
    expect(row.cells.regular).toBe("01:00:00");
    expect(row.cells.manual).toBe("00:30:00");
    expect(row.cells.total).toBe("01:30:00");
  });

  it("lists each distinct project once on a group row", () => {
    const [row] = build(
      [entry({ id: "a" }), entry({ id: "b", startedAt: "2026-09-28T12:00:00" }), entry({ id: "c", startedAt: "2026-09-28T13:00:00", projectName: "Beta" })],
      "day",
    );
    expect(row.cells.project).toBe("Alpha, Beta");
  });

  it("shows a member's team names in the Team cell", () => {
    const [row] = build([entry({})], "day", { teamNames: new Map([["m1", ["Dev"]]]) });
    expect(row.teams).toEqual(["Dev"]);
  });

  it("sums paused seconds into break time", () => {
    const [row] = build([entry({ pausedSeconds: 90 })], "day");
    expect(row.cells.breakTime).toBe("00:01:30");
  });
});

describe("buildTimeActivityRows week grouping", () => {
  const twoTeams = new Map([["m1", ["Dev", "Design"]]]);

  it("labels the week with both end days, in full", () => {
    const [row] = build([entry({ id: "a" })], "week");
    expect(row.cells.date).toMatch(/^Mon, Sep 28, 2026 - Sun, Oct 4, 2026 \(1\)$/);
  });

  it("gives a member on two teams one row per day and project, listing both teams", () => {
    const [row] = build([entry({ id: "a" })], "week", { teamNames: twoTeams });
    expect(row.subRows).toHaveLength(1);
    expect(row.subRows?.[0].cells.team).toBe("Dev, Design");
    expect(row.cells.date).toMatch(/\(1\)$/);
  });

  it("still gives one row per day", () => {
    const [row] = build(
      [entry({ id: "a" }), entry({ id: "b", startedAt: "2026-09-29T09:00:00" })],
      "week",
      { teamNames: twoTeams },
    );
    expect(row.subRows).toHaveLength(2);
  });
});

describe("buildTimeActivityRows idle members", () => {
  const idle = [
    { id: "m1", label: "Ada" },
    { id: "m2", label: "Bob" },
  ];

  it("lists a member with no entries as a zero-hour row under member grouping", () => {
    const rows = build([entry({ id: "a" })], "member", { idleMembers: idle });
    expect(rows.map((r) => r.cells.date)).toEqual(["Ada (1)", "Bob (0)"]);
    expect(rows[1].cells.total).toBe("00:00:00");
    expect(rows[1].subRows).toBeUndefined();
  });

  it("doesn't duplicate a member who already has a row", () => {
    expect(build([entry({ id: "a" })], "member", { idleMembers: [idle[0]] })).toHaveLength(1);
  });

  it("only adds them under member grouping", () => {
    expect(build([entry({ id: "a" })], "day", { idleMembers: idle })).toHaveLength(1);
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
