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

  it("defaults to now when no reference date is given", () => {
    const range = getTimesheetDateRange("today");
    const today = new Date();

    expect(range.from.getDate()).toBe(today.getDate());
  });
});
