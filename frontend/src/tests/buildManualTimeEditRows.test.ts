import { describe, expect, it } from "vitest";
import { buildManualTimeEditRows } from "@/lib/buildManualTimeEditRows";
import type { ManualTimeEdit } from "@/types/manualTimeEdit";

const edit: ManualTimeEdit = {
  id: "a1",
  action: "delete",
  membershipId: "m1",
  memberName: null,
  memberEmail: "ana@example.com",
  projectId: "p1",
  projectName: "Website",
  taskName: null,
  startedAt: "2026-10-05T08:00:00.000Z",
  endedAt: "2026-10-05T09:00:00.000Z",
  changeSeconds: -3600,
  reason: "Logged twice",
  changedByName: "Admin",
  changedAt: "2026-10-05T10:00:00.000Z",
};

describe("buildManualTimeEditRows", () => {
  it("labels the action, signs the change and falls back to the email and dashes", () => {
    const [row] = buildManualTimeEditRows([edit], "UTC");
    expect(row.cells).toMatchObject({
      member: "ana@example.com",
      task: "-",
      action: "Delete",
      change: "-01:00:00",
      reason: "Logged twice",
      changedBy: "Admin",
    });
  });

  it("sorts the most recent edit first", () => {
    const [older, newer] = buildManualTimeEditRows(
      [edit, { ...edit, id: "a2", changedAt: "2026-10-06T10:00:00.000Z" }],
      "UTC",
    );
    expect(newer.sortKey).toBeLessThan(older.sortKey as number);
  });
});
