import { describe, expect, it } from "vitest";
import { buildWeekDays } from "@/lib/buildWeekDays";

const WEEK = [
  { date: "2026-01-04", seconds: 0 }, // Sun
  { date: "2026-01-05", seconds: 5400 }, // Mon
  { date: "2026-01-06", seconds: 0 }, // Tue
  { date: "2026-01-07", seconds: 7200 }, // Wed
  { date: "2026-01-08", seconds: 0 }, // Thu
  { date: "2026-01-09", seconds: 0 }, // Fri
  { date: "2026-01-10", seconds: 0 }, // Sat
];

describe("buildWeekDays", () => {
  it("labels each day by its Sunday-first position and carries its seconds through", () => {
    const result = buildWeekDays(WEEK, new Date(2026, 0, 7, 15, 0, 0));

    expect(result.map((day) => day.label)).toEqual([
      "Sun",
      "Mon",
      "Tue",
      "Wed",
      "Thu",
      "Fri",
      "Sat",
    ]);
    expect(result.map((day) => day.seconds)).toEqual([
      0, 5400, 0, 7200, 0, 0, 0,
    ]);
  });

  it("marks only the day matching now's local calendar date as today", () => {
    const result = buildWeekDays(WEEK, new Date(2026, 0, 7, 15, 0, 0));

    expect(result.map((day) => day.isToday)).toEqual([
      false,
      false,
      false,
      true,
      false,
      false,
      false,
    ]);
  });

  it("marks no day as today when now falls outside the given week", () => {
    const result = buildWeekDays(WEEK, new Date(2026, 0, 20, 15, 0, 0));

    expect(result.every((day) => !day.isToday)).toBe(true);
  });
});
