import { describe, expect, it } from "vitest";
import { timeRangeFromParts, timeRangeToParts } from "@/lib/timeRangeParts";

describe("timeRangeFromParts", () => {
  it("reads both times against the one date", () => {
    const range = timeRangeFromParts({
      date: "2026-01-05",
      startTime: "09:00",
      endTime: "17:30",
    });

    expect(range).toEqual({
      startedAt: "2026-01-05T09:00",
      endedAt: "2026-01-05T17:30",
      endsNextDay: false,
    });
  });

  it("carries an end earlier than its start onto the next day", () => {
    const range = timeRangeFromParts({
      date: "2026-01-05",
      startTime: "23:00",
      endTime: "01:00",
    });

    expect(range.endedAt).toBe("2026-01-06T01:00");
    expect(range.endsNextDay).toBe(true);
  });

  // Equal times are a zero-length entry on the same day, which the form
  // refuses — carried over, it is a full day's work, which it does not.
  it("carries an end equal to its start onto the next day", () => {
    expect(
      timeRangeFromParts({
        date: "2026-01-05",
        startTime: "09:00",
        endTime: "09:00",
      }).endedAt,
    ).toBe("2026-01-06T09:00");
  });

  it("crosses a month end", () => {
    expect(
      timeRangeFromParts({
        date: "2026-01-31",
        startTime: "22:00",
        endTime: "02:00",
      }).endedAt,
    ).toBe("2026-02-01T02:00");
  });

  it("leaves a half-filled pair empty rather than half-formed", () => {
    expect(
      timeRangeFromParts({ date: "", startTime: "09:00", endTime: "10:00" }),
    ).toEqual({ startedAt: "", endedAt: "", endsNextDay: false });

    expect(
      timeRangeFromParts({ date: "2026-01-05", startTime: "", endTime: "" }),
    ).toEqual({ startedAt: "", endedAt: "", endsNextDay: false });
  });
});

describe("timeRangeToParts", () => {
  // No trailing Z: these stand for wall-clock times, so the test reads them
  // the same way the form does rather than by the runner's timezone.
  it("dates the pair by the start, so an overnight end re-derives itself", () => {
    const parts = timeRangeToParts("2026-01-05T23:00", "2026-01-06T01:00");

    expect(parts).toEqual({
      date: "2026-01-05",
      startTime: "23:00",
      endTime: "01:00",
    });
    expect(timeRangeFromParts(parts).endedAt).toBe("2026-01-06T01:00");
  });

  it("leaves an entry that has not ended without an end time", () => {
    expect(timeRangeToParts("2026-01-05T09:00", null).endTime).toBe("");
    expect(timeRangeToParts(undefined, undefined)).toEqual({
      date: "",
      startTime: "",
      endTime: "",
    });
  });
});
