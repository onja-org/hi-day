import { describe, expect, it } from "vitest";
import { getTimesheetDateRange } from "@/lib/getTimesheetDateRange";

describe("getTimesheetDateRange", () => {
  // A Wednesday, so week-based presets have a non-trivial Monday offset.
  const now = new Date(2026, 0, 7, 15, 30);

  it("returns today's local midnight-to-midnight range for 'today'", () => {
    const range = getTimesheetDateRange("today", now);

    expect(range.from).toEqual(new Date(2026, 0, 7, 0, 0, 0, 0));
    expect(range.to).toEqual(new Date(2026, 0, 7, 23, 59, 59, 999));
  });

  it("returns the previous day's range for 'yesterday'", () => {
    const range = getTimesheetDateRange("yesterday", now);

    expect(range.from).toEqual(new Date(2026, 0, 6, 0, 0, 0, 0));
    expect(range.to).toEqual(new Date(2026, 0, 6, 23, 59, 59, 999));
  });

  it("returns the six days before today plus today for 'last_7_days'", () => {
    const range = getTimesheetDateRange("last_7_days", now);

    expect(range.from).toEqual(new Date(2026, 0, 1, 0, 0, 0, 0));
    expect(range.to).toEqual(new Date(2026, 0, 7, 23, 59, 59, 999));
  });

  it("returns the previous Monday-to-Sunday week for 'last_week'", () => {
    const range = getTimesheetDateRange("last_week", now);

    // Jan 7 2026 is a Wednesday; this week's Monday is Jan 5.
    expect(range.from).toEqual(new Date(2025, 11, 29, 0, 0, 0, 0));
    expect(range.to).toEqual(new Date(2026, 0, 4, 23, 59, 59, 999));
  });

  it("returns the two whole weeks before this one for 'last_2_weeks'", () => {
    const range = getTimesheetDateRange("last_2_weeks", now);

    expect(range.from).toEqual(new Date(2025, 11, 22, 0, 0, 0, 0));
    expect(range.to).toEqual(new Date(2026, 0, 4, 23, 59, 59, 999));
  });

  it("returns the 1st-through-today for 'this_month'", () => {
    const range = getTimesheetDateRange("this_month", now);

    expect(range.from).toEqual(new Date(2026, 0, 1, 0, 0, 0, 0));
    expect(range.to).toEqual(new Date(2026, 0, 7, 23, 59, 59, 999));
  });

  it("returns the whole previous month for 'last_month', across a year boundary", () => {
    const range = getTimesheetDateRange("last_month", now);

    expect(range.from).toEqual(new Date(2025, 11, 1, 0, 0, 0, 0));
    expect(range.to).toEqual(new Date(2025, 11, 31, 23, 59, 59, 999));
  });

  it("treats a Sunday as the last day of its week, not the first", () => {
    const sunday = new Date(2026, 0, 11, 9, 0);
    const range = getTimesheetDateRange("last_week", sunday);

    expect(range.from).toEqual(new Date(2025, 11, 29, 0, 0, 0, 0));
  });

  // The same cases as the backend's report-date-range.util.spec.ts, so a
  // saved or scheduled "This week" covers the days the browser showed.
  describe("'this_week' — the whole calendar week, not seven days back", () => {
    const days = (now: Date, weekStart: "monday" | "sunday" = "monday") => {
      const range = getTimesheetDateRange("this_week", now, undefined, weekStart);
      return [range.from, range.to];
    };

    it.each([
      ["a Wednesday", new Date(2026, 0, 7, 15, 30)],
      ["a Monday", new Date(2026, 0, 5, 8, 0)],
      ["a Sunday", new Date(2026, 0, 11, 21, 0)],
    ])("covers Monday to Sunday on %s", (_label, now) => {
      expect(days(now)).toEqual([
        new Date(2026, 0, 5, 0, 0, 0, 0),
        new Date(2026, 0, 11, 23, 59, 59, 999),
      ]);
    });

    it("includes the days after today, which simply have nothing yet", () => {
      const [, to] = days(new Date(2026, 0, 7, 15, 30));
      expect(to.getTime()).toBeGreaterThan(new Date(2026, 0, 7, 23, 59, 59, 999).getTime());
    });

    it("crosses a year boundary", () => {
      expect(days(new Date(2026, 0, 1, 12, 0))).toEqual([
        new Date(2025, 11, 29, 0, 0, 0, 0),
        new Date(2026, 0, 4, 23, 59, 59, 999),
      ]);
    });

    it.each([
      ["a Wednesday", new Date(2026, 0, 7, 15, 30), [4, 10]],
      ["a Sunday, its first day", new Date(2026, 0, 11, 9, 0), [11, 17]],
      ["a Saturday, its last day", new Date(2026, 0, 10, 9, 0), [4, 10]],
    ] as const)(
      "runs Sunday to Saturday for an organisation whose weeks start on Sunday, on %s",
      (_label, now, [first, last]) => {
        expect(days(now, "sunday")).toEqual([
          new Date(2026, 0, first, 0, 0, 0, 0),
          new Date(2026, 0, last, 23, 59, 59, 999),
        ]);
      },
    );
  });

  it("defaults to now when no reference date is given", () => {
    const range = getTimesheetDateRange("today");
    const today = new Date();

    expect(range.from.getDate()).toBe(today.getDate());
  });

  describe("in a chosen timezone", () => {
    const NAIROBI = "Africa/Nairobi"; // UTC+3
    const NEW_YORK = "America/New_York"; // UTC-5 in January

    // 22:30Z is already tomorrow in Nairobi, but not in New York.
    const lateEvening = new Date("2026-01-07T22:30:00.000Z");

    it("resolves 'today' to the day it is in that zone", () => {
      const nairobi = getTimesheetDateRange("today", lateEvening, NAIROBI);
      const newYork = getTimesheetDateRange("today", lateEvening, NEW_YORK);

      expect(nairobi.from.toISOString()).toBe("2026-01-07T21:00:00.000Z");
      expect(newYork.from.toISOString()).toBe("2026-01-07T05:00:00.000Z");
    });

    it("ends on the last millisecond of that zone's day", () => {
      const range = getTimesheetDateRange("today", lateEvening, NAIROBI);

      expect(range.to.toISOString()).toBe("2026-01-08T20:59:59.999Z");
    });

    it("spans seven of that zone's days for 'last 7 days'", () => {
      const range = getTimesheetDateRange("last_7_days", lateEvening, NAIROBI);

      expect(range.from.toISOString()).toBe("2026-01-01T21:00:00.000Z");
    });

    it("respects a short day at a daylight-saving transition", () => {
      const range = getTimesheetDateRange(
        "today",
        new Date("2026-03-08T12:00:00.000Z"),
        NEW_YORK,
      );

      expect(range.from.toISOString()).toBe("2026-03-08T05:00:00.000Z");
      // The 9th begins at 04:00Z, not 05:00Z, because the clocks went
      // forward — so the 8th ends an hour "early" and is 23 hours long.
      expect(range.to.toISOString()).toBe("2026-03-09T03:59:59.999Z");
      expect(
        Math.round((range.to.getTime() + 1 - range.from.getTime()) / 3_600_000),
      ).toBe(23);
    });

    it("starts last month on the first of that month in the chosen zone", () => {
      const range = getTimesheetDateRange("last_month", lateEvening, NAIROBI);

      expect(range.from.toISOString()).toBe("2025-11-30T21:00:00.000Z");
      expect(range.to.toISOString()).toBe("2025-12-31T20:59:59.999Z");
    });
  });
});
