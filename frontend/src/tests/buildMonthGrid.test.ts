import { describe, expect, it } from "vitest";
import { buildMonthGrid } from "@/lib/buildMonthGrid";

describe("buildMonthGrid", () => {
  it("returns 42 consecutive days starting on the Monday on or before the 1st", () => {
    // Sep 1 2026 is a Tuesday.
    const grid = buildMonthGrid(new Date(2026, 8, 15));

    expect(grid).toHaveLength(42);
    expect(grid[0]).toEqual(new Date(2026, 7, 31));
    expect(grid[1]).toEqual(new Date(2026, 8, 1));
    expect(grid[41]).toEqual(new Date(2026, 9, 11));
  });

  it("starts on the 1st itself when the month begins on a Monday", () => {
    // Jun 1 2026 is a Monday.
    const grid = buildMonthGrid(new Date(2026, 5, 1));

    expect(grid[0]).toEqual(new Date(2026, 5, 1));
  });

  it("starts in the previous week when the month begins on a Sunday", () => {
    // Nov 1 2026 is a Sunday.
    const grid = buildMonthGrid(new Date(2026, 10, 1));

    expect(grid[0]).toEqual(new Date(2026, 9, 26));
    expect(grid[6]).toEqual(new Date(2026, 10, 1));
  });
});
