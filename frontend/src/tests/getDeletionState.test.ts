import { describe, expect, it } from "vitest";
import { getDeletionState } from "@/lib/getDeletionState";

const NOW = new Date("2026-10-06T12:00:00.000Z");

describe("getDeletionState", () => {
  it("is active when nothing is set", () => {
    expect(
      getDeletionState(
        { suspendedAt: null, deletionScheduledFor: null, purgeAt: null },
        NOW,
      ),
    ).toBe("active");
  });

  it("is scheduled when only a future date is set", () => {
    expect(
      getDeletionState(
        {
          suspendedAt: null,
          deletionScheduledFor: "2026-12-01T00:00:00.000Z",
          purgeAt: null,
        },
        NOW,
      ),
    ).toBe("scheduled");
  });

  it("is suspended when suspendedAt is set, even if a schedule is still recorded", () => {
    expect(
      getDeletionState(
        {
          suspendedAt: "2026-10-01T00:00:00.000Z",
          deletionScheduledFor: "2026-10-01T00:00:00.000Z",
          purgeAt: "2026-10-31T00:00:00.000Z",
        },
        NOW,
      ),
    ).toBe("suspended");
  });

  it("is purging once purgeAt has been reached", () => {
    expect(
      getDeletionState(
        {
          suspendedAt: "2026-10-06T12:00:00.000Z",
          deletionScheduledFor: null,
          purgeAt: "2026-10-06T12:00:00.000Z",
        },
        NOW,
      ),
    ).toBe("purging");
  });
});
