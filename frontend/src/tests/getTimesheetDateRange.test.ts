import { describe, expect, it } from "vitest";
import { getTimesheetDateRange } from "@/lib/getTimesheetDateRange";

describe("getTimesheetDateRange", () => {
  // A Wednesday, so "this_week" has a non-trivial start-of-week offset.
  const now = new Date(2026, 0, 7, 15, 30);

  it("returns null for 'all' (no filter)", () => {
    expect(getTimesheetDateRange("all", now)).toBeNull();
  });

  it("returns today's local midnight-to-midnight range for 'today'", () => {
    const range = getTimesheetDateRange("today", now);

    expect(range).not.toBeNull();
    expect(range!.from).toEqual(new Date(2026, 0, 7, 0, 0, 0, 0));
    expect(range!.to).toEqual(new Date(2026, 0, 7, 23, 59, 59, 999));
  });

  it("returns the previous day's range for 'yesterday'", () => {
    const range = getTimesheetDateRange("yesterday", now);

    expect(range!.from).toEqual(new Date(2026, 0, 6, 0, 0, 0, 0));
    expect(range!.to).toEqual(new Date(2026, 0, 6, 23, 59, 59, 999));
  });

  it("returns Sunday-through-today for 'this_week'", () => {
    const range = getTimesheetDateRange("this_week", now);

    // Jan 7 2026 is a Wednesday; the week's Sunday is Jan 4.
    expect(range!.from).toEqual(new Date(2026, 0, 4, 0, 0, 0, 0));
    expect(range!.to).toEqual(new Date(2026, 0, 7, 23, 59, 59, 999));
  });

  it("returns the 1st-through-today for 'this_month'", () => {
    const range = getTimesheetDateRange("this_month", now);

    expect(range!.from).toEqual(new Date(2026, 0, 1, 0, 0, 0, 0));
    expect(range!.to).toEqual(new Date(2026, 0, 7, 23, 59, 59, 999));
  });

  it("defaults to now when no reference date is given", () => {
    const range = getTimesheetDateRange("today");
    const today = new Date();

    expect(range!.from.getDate()).toBe(today.getDate());
  });
});
