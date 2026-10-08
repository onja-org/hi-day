import { describe, expect, it } from "vitest";
import { sumManualTimeEdits } from "@/lib/sumManualTimeEdits";
import type { ManualTimeEdit } from "@/types/manualTimeEdit";

function edit(changeSeconds: number): ManualTimeEdit {
  return {
    id: String(changeSeconds),
    action: "edit",
    membershipId: "m1",
    memberName: null,
    memberEmail: null,
    projectId: null,
    projectName: null,
    taskName: null,
    startedAt: null,
    endedAt: null,
    changeSeconds,
    reason: null,
    changedByName: null,
    changedAt: "2026-10-05T10:00:00.000Z",
  };
}

describe("sumManualTimeEdits", () => {
  it("totals time added and time removed separately", () => {
    expect(sumManualTimeEdits([edit(3600), edit(1800), edit(-900), edit(0)])).toEqual({
      addedSeconds: 5400,
      deletedSeconds: 900,
    });
  });

  it("is zero for no edits", () => {
    expect(sumManualTimeEdits([])).toEqual({ addedSeconds: 0, deletedSeconds: 0 });
  });
});
