import { describe, expect, it } from "vitest";
import { nextScheduledRun } from "@/lib/nextScheduledRun";

describe("nextScheduledRun", () => {
  const weekdays = [1, 2, 3, 4, 5];

  it("returns today when the delivery hour is still ahead", () => {
    // Wed 2026-10-07 10:00 UTC
    const next = nextScheduledRun({ frequency: "daily", hour: 16, days: weekdays }, new Date("2026-10-07T10:00:00Z"), "UTC");
    expect(next?.toISOString()).toBe("2026-10-07T16:00:00.000Z");
  });

  it("moves to the next chosen weekday once the hour has passed", () => {
    // Fri 2026-10-09 17:00 UTC -> Monday
    const next = nextScheduledRun({ frequency: "weekly", hour: 16, days: weekdays }, new Date("2026-10-09T17:00:00Z"), "UTC");
    expect(next?.toISOString()).toBe("2026-10-12T16:00:00.000Z");
  });

  it("reads the hour on the given zone's wall clock", () => {
    const next = nextScheduledRun({ frequency: "daily", hour: 9, days: [3] }, new Date("2026-10-06T23:00:00Z"), "Asia/Tokyo");
    expect(next?.toISOString()).toBe("2026-10-07T00:00:00.000Z");
  });

  it("delivers monthly only on the first chosen weekday of the month", () => {
    // Mondays: Oct 5 has passed, so the next first-Monday is Nov 2.
    const next = nextScheduledRun({ frequency: "monthly", hour: 8, days: [1] }, new Date("2026-10-07T00:00:00Z"), "UTC");
    expect(next?.toISOString()).toBe("2026-11-02T08:00:00.000Z");
  });

  it("returns null with no delivery days", () => {
    expect(nextScheduledRun({ frequency: "daily", hour: 8, days: [] }, new Date(), "UTC")).toBeNull();
  });
});
