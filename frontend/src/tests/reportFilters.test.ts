import { describe, expect, it } from "vitest";
import {
  EMPTY_REPORT_FILTERS,
  countReportFilters,
  filterReportEntries,
  filterReportMembers,
} from "@/lib/reportFilters";
import type { TimeEntryListItem } from "@/types/timeEntry";

function entry(id: string, membershipId: string, projectId: string): TimeEntryListItem {
  return {
    id,
    membershipId,
    projectId,
    taskId: null,
    startedAt: "2026-09-28T09:00:00",
    endedAt: "2026-09-28T10:00:00",
    source: "web",
    deviceId: null,
    pausedAt: null,
    pausedSeconds: 0,
    projectName: projectId,
    projectColour: "blue",
    taskName: null,
    durationSeconds: 3600,
    memberName: null,
    memberEmail: null,
    canEdit: false,
    canDelete: false,
    pauses: [],
    type: "normal",
    activePercentage: null,
  };
}

const entries = [entry("1", "m1", "p1"), entry("2", "m2", "p1"), entry("3", "m2", "p2")];
const members = new Map([
  ["m1", ["t1"]],
  ["m2", ["t2"]],
]);

describe("filterReportEntries", () => {
  it("keeps everything when no filter is set", () => {
    expect(filterReportEntries(entries, EMPTY_REPORT_FILTERS, members)).toEqual(entries);
  });

  it("filters by member", () => {
    const result = filterReportEntries(entries, { ...EMPTY_REPORT_FILTERS, memberIds: ["m2"] }, members);
    expect(result.map((e) => e.id)).toEqual(["2", "3"]);
  });

  it("filters by team through the member's teams", () => {
    const result = filterReportEntries(entries, { ...EMPTY_REPORT_FILTERS, teamIds: ["t1"] }, members);
    expect(result.map((e) => e.id)).toEqual(["1"]);
  });

  it("filters by project", () => {
    const result = filterReportEntries(entries, { ...EMPTY_REPORT_FILTERS, projectIds: ["p2"] }, members);
    expect(result.map((e) => e.id)).toEqual(["3"]);
  });

  it("ORs within a filter", () => {
    const result = filterReportEntries(entries, { ...EMPTY_REPORT_FILTERS, memberIds: ["m1", "m2"] }, members);
    expect(result).toHaveLength(3);
  });

  it("ANDs across filters", () => {
    const result = filterReportEntries(
      entries,
      { memberIds: ["m2"], teamIds: [], projectIds: ["p1"] },
      members,
    );
    expect(result.map((e) => e.id)).toEqual(["2"]);
  });

  it("drops entries whose member isn't on the chosen team, or unknown", () => {
    const result = filterReportEntries(entries, { ...EMPTY_REPORT_FILTERS, teamIds: ["t1"] }, new Map());
    expect(result).toEqual([]);
  });
});

describe("countReportFilters", () => {
  it("adds up every chosen value", () => {
    expect(countReportFilters({ memberIds: ["a"], teamIds: ["b", "c"], projectIds: [] })).toBe(3);
  });

  it("is zero when empty", () => {
    expect(countReportFilters(EMPTY_REPORT_FILTERS)).toBe(0);
  });
});

describe("filterReportMembers", () => {
  const people = [{ id: "m1" }, { id: "m2" }];

  it("keeps everyone when no filter is set", () => {
    expect(filterReportMembers(people, EMPTY_REPORT_FILTERS, members)).toEqual(people);
  });

  it("keeps only the chosen members", () => {
    expect(filterReportMembers(people, { ...EMPTY_REPORT_FILTERS, memberIds: ["m2"] }, members)).toEqual([{ id: "m2" }]);
  });

  it("keeps only members on the chosen teams", () => {
    expect(filterReportMembers(people, { ...EMPTY_REPORT_FILTERS, teamIds: ["t1"] }, members)).toEqual([{ id: "m1" }]);
  });
});
