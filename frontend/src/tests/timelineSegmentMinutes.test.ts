import { describe, expect, it } from "vitest";
import { timelineSegmentMinutes } from "@/lib/timelineSegmentMinutes";

const dayStart = new Date("2026-03-10T00:00:00Z");

describe("timelineSegmentMinutes", () => {
  it("places a segment by minutes from the day's start", () => {
    expect(
      timelineSegmentMinutes(
        { start: "2026-03-10T09:00:00Z", end: "2026-03-10T10:30:00Z" },
        dayStart,
      ),
    ).toEqual({ startMinute: 540, endMinute: 630 });
  });

  it("clamps a segment that starts before the day", () => {
    expect(
      timelineSegmentMinutes(
        { start: "2026-03-09T23:00:00Z", end: "2026-03-10T01:00:00Z" },
        dayStart,
      ),
    ).toEqual({ startMinute: 0, endMinute: 60 });
  });

  it("clamps to a short daylight-saving day's own length", () => {
    expect(
      timelineSegmentMinutes(
        { start: "2026-03-10T22:00:00Z", end: "2026-03-11T01:00:00Z" },
        dayStart,
        23 * 60,
      ),
    ).toEqual({ startMinute: 1320, endMinute: 1380 });
  });
});
