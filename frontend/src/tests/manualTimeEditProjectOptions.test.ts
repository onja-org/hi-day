import { describe, expect, it } from "vitest";
import { manualTimeEditProjectOptions } from "@/lib/manualTimeEditProjectOptions";
import type { ManualTimeEdit } from "@/types/manualTimeEdit";

const base: ManualTimeEdit = {
  id: "a1",
  action: "add",
  membershipId: "m1",
  memberName: null,
  memberEmail: null,
  projectId: "p2",
  projectName: "Archived",
  taskName: null,
  startedAt: null,
  endedAt: null,
  changeSeconds: 0,
  reason: null,
  changedByName: null,
  changedAt: "2026-10-05T10:00:00.000Z",
};

describe("manualTimeEditProjectOptions", () => {
  it("adds projects only seen in the edits, sorted by name", () => {
    const options = manualTimeEditProjectOptions([{ id: "p1", name: "Website" }], [base]);
    expect(options).toEqual([
      { id: "p2", name: "Archived" },
      { id: "p1", name: "Website" },
    ]);
  });

  it("prefers the assigned name over an edit's copy", () => {
    const options = manualTimeEditProjectOptions([{ id: "p2", name: "Renamed" }], [base]);
    expect(options).toEqual([{ id: "p2", name: "Renamed" }]);
  });
});
