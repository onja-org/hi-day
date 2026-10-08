import { describe, expect, it } from "vitest";
import { filterManualTimeEdits } from "@/lib/filterManualTimeEdits";
import { EMPTY_REPORT_FILTERS } from "@/lib/reportFilters";
import type { ManualTimeEdit } from "@/types/manualTimeEdit";

function edit(overrides: Partial<ManualTimeEdit>): ManualTimeEdit {
  return {
    id: "a1",
    action: "add",
    membershipId: "m1",
    memberName: "Ana",
    memberEmail: "ana@example.com",
    projectId: "p1",
    projectName: "Website",
    taskName: null,
    startedAt: "2026-10-05T08:00:00.000Z",
    endedAt: "2026-10-05T09:00:00.000Z",
    changeSeconds: 3600,
    reason: null,
    changedByName: "Admin",
    changedAt: "2026-10-05T10:00:00.000Z",
    ...overrides,
  };
}

describe("filterManualTimeEdits", () => {
  const edits = [
    edit({ id: "a1" }),
    edit({ id: "a2", action: "delete", membershipId: "m2", projectId: "p2" }),
    edit({ id: "a3", action: "edit", projectId: null }),
  ];

  it("narrows nothing when no filter is set", () => {
    expect(filterManualTimeEdits(edits, EMPTY_REPORT_FILTERS, "all")).toHaveLength(3);
  });

  it("keeps only the chosen action", () => {
    expect(filterManualTimeEdits(edits, EMPTY_REPORT_FILTERS, "delete").map((e) => e.id)).toEqual(["a2"]);
  });

  it("keeps only the chosen members and projects together", () => {
    const filters = { ...EMPTY_REPORT_FILTERS, memberIds: ["m1"], projectIds: ["p1"] };
    expect(filterManualTimeEdits(edits, filters, "all").map((e) => e.id)).toEqual(["a1"]);
  });
});
