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
      projectIds: new Set(["p-2"]),
    });

    expect(result.map((entry) => entry.id)).toEqual(["agent", "manual"]);
  });

  it("narrows to the chosen sources", () => {
    const result = filterTimeEntries([WEB, AGENT, MANUAL], {
      ...EMPTY_TIMESHEET_FILTERS,
      sources: new Set(["manual" as const]),
    });

    expect(result.map((entry) => entry.id)).toEqual(["manual"]);
  });

  // The point of the panel: every section applies at once.
  it("requires an entry to satisfy every filter, not any of them", () => {
    const result = filterTimeEntries([WEB, AGENT, MANUAL], {
      projectIds: new Set(["p-2"]),
      sources: new Set(["manual" as const]),
    });

    expect(result.map((entry) => entry.id)).toEqual(["manual"]);
  });

  it("returns nothing when the combination matches nothing", () => {
    const result = filterTimeEntries([WEB, AGENT, MANUAL], {
      projectIds: new Set(["p-1"]),
      sources: new Set(["manual" as const]),
    });

    expect(result).toEqual([]);
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
  it("counts every selection across sections", () => {
    expect(
      countActiveFilters({
        projectIds: new Set(["p-1", "p-2"]),
        sources: new Set(["web" as const]),
      }),
    ).toBe(3);
  });

  it("is zero for a fresh panel", () => {
    expect(countActiveFilters(EMPTY_TIMESHEET_FILTERS)).toBe(0);
  });
});
