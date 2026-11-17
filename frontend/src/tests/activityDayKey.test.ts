import { describe, expect, it } from "vitest";
import { activityDayKey } from "@/lib/activityDayKey";

describe("activityDayKey", () => {
  it("is today on the organisation's calendar, east of UTC", () => {
    // 01:30 on Tuesday 3 Nov in Nairobi — still Monday in UTC.
    const now = new Date("2026-11-02T22:30:00Z");

    expect(activityDayKey(now, "Africa/Nairobi")).toBe("2026-11-03");
  });

  it("is today on the organisation's calendar, west of UTC", () => {
    // 20:00 on Monday 2 Nov in New York — already Tuesday in UTC.
    const now = new Date("2026-11-03T01:00:00Z");

    expect(activityDayKey(now, "America/New_York")).toBe("2026-11-02");
  });

  it("steps whole calendar days by offset, across a month end", () => {
    const now = new Date("2026-11-01T12:00:00Z");

    expect(activityDayKey(now, "UTC", -1)).toBe("2026-10-31");
    expect(activityDayKey(now, "UTC", 1)).toBe("2026-11-02");
  });
});
