import { describe, expect, it } from "vitest";
import { getDeletionState } from "@/lib/getDeletionState";

describe("getDeletionState", () => {
  it("is active when nothing is set", () => {
    expect(
      getDeletionState({ suspendedAt: null, deletionScheduledFor: null }),
    ).toBe("active");
  });

  it("is scheduled when only a future date is set", () => {
    expect(
      getDeletionState({
        suspendedAt: null,
        deletionScheduledFor: "2026-12-01T00:00:00.000Z",
      }),
    ).toBe("scheduled");
  });

  it("is suspended when suspendedAt is set, even if a schedule is still recorded", () => {
    expect(
      getDeletionState({
        suspendedAt: "2026-10-01T00:00:00.000Z",
        deletionScheduledFor: "2026-10-01T00:00:00.000Z",
      }),
    ).toBe("suspended");
  });
});
