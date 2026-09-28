import { describe, expect, it } from "vitest";
import { selectRangeDay } from "@/lib/selectRangeDay";

describe("selectRangeDay", () => {
  const applied = {
    from: new Date(2026, 8, 1),
    to: new Date(2026, 8, 5),
    pickingEnd: false,
  };

  it("starts a new single-day range on the first click", () => {
    const result = selectRangeDay(applied, new Date(2026, 8, 10, 14, 30));

    expect(result).toEqual({
      from: new Date(2026, 8, 10),
      to: new Date(2026, 8, 10),
      pickingEnd: true,
    });
  });

  it("closes the range on the second click", () => {
    const started = selectRangeDay(applied, new Date(2026, 8, 10));
    const result = selectRangeDay(started, new Date(2026, 8, 14));

    expect(result).toEqual({
      from: new Date(2026, 8, 10),
      to: new Date(2026, 8, 14),
      pickingEnd: false,
    });
  });

  it("swaps the ends when the second click is earlier than the first", () => {
    const started = selectRangeDay(applied, new Date(2026, 8, 10));
    const result = selectRangeDay(started, new Date(2026, 8, 3));

    expect(result).toEqual({
      from: new Date(2026, 8, 3),
      to: new Date(2026, 8, 10),
      pickingEnd: false,
    });
  });

  it("keeps a single-day range when the same day is clicked twice", () => {
    const started = selectRangeDay(applied, new Date(2026, 8, 10));
    const result = selectRangeDay(started, new Date(2026, 8, 10));

    expect(result.from).toEqual(result.to);
    expect(result.pickingEnd).toBe(false);
  });
});
