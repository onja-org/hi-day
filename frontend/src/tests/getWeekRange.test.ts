import { describe, expect, it } from "vitest";
import { getWeekRange } from "@/lib/getWeekRange";

describe("getWeekRange", () => {
  it("resolves a Wednesday to that week's Monday–Sunday range", () => {
    const { start, end } = getWeekRange(new Date(2026, 0, 7, 15, 30)); // Wed Jan 7 2026

    expect(start).toEqual(new Date(2026, 0, 5, 0, 0, 0, 0));
    expect(end.getFullYear()).toBe(2026);
    expect(end.getMonth()).toBe(0);
    expect(end.getDate()).toBe(11);
    expect(end.getHours()).toBe(23);
  });

  it("treats a Monday as the first day of its own week", () => {
    const { start } = getWeekRange(new Date(2026, 0, 5, 9, 0));

    expect(start).toEqual(new Date(2026, 0, 5, 0, 0, 0, 0));
  });

  it("treats a Sunday as the last day of the prior Monday's week", () => {
    const { start, end } = getWeekRange(new Date(2026, 0, 11, 9, 0)); // Sun Jan 11 2026

    expect(start).toEqual(new Date(2026, 0, 5, 0, 0, 0, 0));
    expect(end.getDate()).toBe(11);
  });

  it("cuts the week on Sunday for an organisation whose weeks start there", () => {
    const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const { start, end } = getWeekRange(new Date(2026, 0, 7, 15, 30), 0, zone, "sunday");

    expect(start).toEqual(new Date(2026, 0, 4, 0, 0, 0, 0));
    expect(end.getDate()).toBe(10);
  });

  it("navigates forward and backward by whole weeks via offset", () => {
    const anchor = new Date(2026, 0, 7);

    expect(getWeekRange(anchor, 1).start).toEqual(new Date(2026, 0, 12, 0, 0, 0, 0));
    expect(getWeekRange(anchor, -1).start).toEqual(new Date(2025, 11, 29, 0, 0, 0, 0));
  });
});
