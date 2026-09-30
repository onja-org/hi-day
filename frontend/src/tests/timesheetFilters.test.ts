import { describe, expect, it } from "vitest";
import {
  EMPTY_TIMESHEET_FILTERS,
  countActiveFilters,
  filterTimeEntries,
  projectOptionsFrom,
} from "@/lib/timesheetFilters";
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

const WEB = makeEntry({ id: "web", projectId: "p-1", source: "web" });
const AGENT = makeEntry({ id: "agent", projectId: "p-2", source: "agent" });
const MANUAL = makeEntry({ id: "manual", projectId: "p-2", source: "manual" });

describe("filterTimeEntries", () => {
  // An empty section means "don't narrow by this", so a fresh panel shows
  // everything rather than nothing.
  it("returns everything when nothing is selected", () => {
    const result = filterTimeEntries([WEB, AGENT, MANUAL], EMPTY_TIMESHEET_FILTERS);

    expect(result).toHaveLength(3);
  });

  it("narrows to the chosen projects", () => {
    const result = filterTimeEntries([WEB, AGENT, MANUAL], {
      ...EMPTY_TIMESHEET_FILTERS,
      projectIds: ["p-2"],
    });

    expect(result.map((entry) => entry.id)).toEqual(["agent", "manual"]);
  });

  it("narrows to the chosen sources", () => {
    const result = filterTimeEntries([WEB, AGENT, MANUAL], {
      ...EMPTY_TIMESHEET_FILTERS,
      sources: ["manual"],
    });

    expect(result.map((entry) => entry.id)).toEqual(["manual"]);
  });

  // Within a section the values are OR-ed — picking two projects means
  // either of them, not both at once, which is impossible for one entry.
  it("treats several values in one section as alternatives", () => {
    const result = filterTimeEntries([WEB, AGENT, MANUAL], {
      ...EMPTY_TIMESHEET_FILTERS,
      sources: ["web", "manual"],
    });

    expect(result.map((entry) => entry.id)).toEqual(["web", "manual"]);
  });

  // The point of the panel: every section applies at once.
  it("requires an entry to satisfy every filter, not any of them", () => {
    const result = filterTimeEntries([WEB, AGENT, MANUAL], {
      ...EMPTY_TIMESHEET_FILTERS,
      projectIds: ["p-2"],
      sources: ["manual"],
    });

    expect(result.map((entry) => entry.id)).toEqual(["manual"]);
  });

  it("narrows to the chosen time types", () => {
    const resumed = makeEntry({ id: "resumed", type: "resumed" });
    const result = filterTimeEntries([WEB, AGENT, MANUAL, resumed], {
      ...EMPTY_TIMESHEET_FILTERS,
      timeTypes: ["resumed"],
    });

    expect(result.map((entry) => entry.id)).toEqual(["resumed"]);
  });

  it("returns nothing when the combination matches nothing", () => {
    const result = filterTimeEntries([WEB, AGENT, MANUAL], {
      ...EMPTY_TIMESHEET_FILTERS,
      projectIds: ["p-1"],
      sources: ["manual"],
    });

    expect(result).toEqual([]);
  });
});

describe("filterTimeEntries by activity level", () => {
  const busy = makeEntry({ id: "busy", activePercentage: 80 });
  const quiet = makeEntry({ id: "quiet", activePercentage: 20 });
  const unmeasured = makeEntry({ id: "unmeasured", activePercentage: null });

  it("keeps only entries above the threshold", () => {
    const result = filterTimeEntries([busy, quiet, unmeasured], {
      ...EMPTY_TIMESHEET_FILTERS,
      minActivePercentage: 60,
    });

    expect(result.map((entry) => entry.id)).toEqual(["busy"]);
  });

  // Showing unmeasured entries under "> 60%" would claim they met a bar
  // nothing ever checked them against.
  it("excludes an entry with no activity measurement", () => {
    const result = filterTimeEntries([unmeasured], {
      ...EMPTY_TIMESHEET_FILTERS,
      minActivePercentage: 10,
    });

    expect(result).toEqual([]);
  });

  it("keeps everything, unmeasured included, when no level is chosen", () => {
    const result = filterTimeEntries([busy, quiet, unmeasured], EMPTY_TIMESHEET_FILTERS);

    expect(result).toHaveLength(3);
  });

  it("is strictly greater than, matching the panel's labels", () => {
    const exactly = makeEntry({ id: "exactly", activePercentage: 60 });

    expect(
      filterTimeEntries([exactly], {
        ...EMPTY_TIMESHEET_FILTERS,
        minActivePercentage: 60,
      }),
    ).toEqual([]);
  });
});

describe("projectOptionsFrom", () => {
  it("lists each project once, by name", () => {
    const options = projectOptionsFrom([
      makeEntry({ projectId: "p-2", projectName: "Mobile" }),
      makeEntry({ projectId: "p-1", projectName: "Website" }),
      makeEntry({ projectId: "p-2", projectName: "Mobile" }),
    ]);

    expect(options).toEqual([
      { id: "p-2", name: "Mobile" },
      { id: "p-1", name: "Website" },
    ]);
  });

  it("sorts by name so the list doesn't reorder as entries change", () => {
    const options = projectOptionsFrom([
      makeEntry({ projectId: "p-1", projectName: "Zebra" }),
      makeEntry({ projectId: "p-2", projectName: "Alpha" }),
    ]);

    expect(options.map((option) => option.name)).toEqual(["Alpha", "Zebra"]);
  });
});

describe("countActiveFilters", () => {
  it("counts every section that is narrowing", () => {
    expect(
      countActiveFilters({
        projectIds: ["p-1"],
        sources: ["web"],
        timeTypes: ["manual"],
        minActivePercentage: 60,
      }),
    ).toBe(4);
  });

  it("ignores the sections left alone", () => {
    expect(
      countActiveFilters({ ...EMPTY_TIMESHEET_FILTERS, sources: ["web"] }),
    ).toBe(1);
  });

  it("is zero for a fresh panel", () => {
    expect(countActiveFilters(EMPTY_TIMESHEET_FILTERS)).toBe(0);
  });
});
