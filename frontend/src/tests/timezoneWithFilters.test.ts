import { describe, expect, it } from "vitest";
import { groupTimeEntriesByDay } from "@/lib/groupTimeEntriesByDay";
import { EMPTY_TIMESHEET_FILTERS, filterTimeEntries } from "@/lib/timesheetFilters";
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
    startedAt: "2026-01-05T22:30:00.000Z",
    endedAt: "2026-01-05T23:00:00.000Z",
    source: "web",
    deviceId: null,
    pausedAt: null,
    pausedSeconds: 0,
    durationSeconds: 1800,
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

const NAIROBI = "Africa/Nairobi";
const NEW_YORK = "America/New_York";

/**
 * Filters decide *which* entries are on screen, the zone decides which day
 * they group under. These pin that the two compose — each is easy to apply
 * in a way that silently defeats the other.
 */
describe("timezone alongside the other filters", () => {
  const web = makeEntry({ id: "web", source: "web", projectId: "p-1" });
  const agent = makeEntry({ id: "agent", source: "agent", projectId: "p-2" });

  it("groups the filtered entries by the chosen zone, not the browser's", () => {
    const filtered = filterTimeEntries([web, agent], {
      ...EMPTY_TIMESHEET_FILTERS,
      sources: ["web"],
    });

    const nairobi = groupTimeEntriesByDay(filtered, null, NAIROBI);
    const newYork = groupTimeEntriesByDay(filtered, null, NEW_YORK);

    expect(filtered.map((entry) => entry.id)).toEqual(["web"]);
    expect(nairobi[0].dateKey).toBe("2026-01-06");
    expect(newYork[0].dateKey).toBe("2026-01-05");
  });

  // Changing the zone must not change what matched — a filter that narrowed
  // by day would break this.
  it("keeps the same entries whichever zone they are read in", () => {
    const filters = {
      ...EMPTY_TIMESHEET_FILTERS,
      projectIds: ["p-2"],
      sources: ["agent" as const],
    };
    const filtered = filterTimeEntries([web, agent], filters);

    for (const zone of [NAIROBI, NEW_YORK]) {
      const grouped = groupTimeEntriesByDay(filtered, null, zone);
      expect(grouped.flatMap((group) => group.entries).map((e) => e.id)).toEqual([
        "agent",
      ]);
    }
  });

  // Totals are per day, so moving the boundary moves the totals with it.
  it("recomputes day totals for the chosen zone", () => {
    const entries = [
      makeEntry({ id: "early", startedAt: "2026-01-05T20:00:00.000Z", durationSeconds: 600 }),
      makeEntry({ id: "late", startedAt: "2026-01-05T22:30:00.000Z", durationSeconds: 1800 }),
    ];

    const newYork = groupTimeEntriesByDay(entries, null, NEW_YORK);
    const nairobi = groupTimeEntriesByDay(entries, null, NAIROBI);

    // One day in New York; two in Nairobi, where the later entry is already
    // tomorrow.
    expect(newYork).toHaveLength(1);
    expect(newYork[0].totalSeconds).toBe(2400);
    expect(nairobi).toHaveLength(2);
    expect(nairobi.map((group) => group.totalSeconds)).toEqual([600, 1800]);
  });

  it("returns nothing in every zone when the filters match nothing", () => {
    const filtered = filterTimeEntries([web, agent], {
      ...EMPTY_TIMESHEET_FILTERS,
      projectIds: ["p-nonexistent"],
    });

    expect(groupTimeEntriesByDay(filtered, null, NAIROBI)).toEqual([]);
    expect(groupTimeEntriesByDay(filtered, null, NEW_YORK)).toEqual([]);
  });
});
