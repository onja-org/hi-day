import { describe, expect, it } from "vitest";
import { comparisonScaleMax } from "@/lib/comparisonScaleMax";

describe("comparisonScaleMax", () => {
  it("is the largest figure shown", () => {
    expect(comparisonScaleMax([3, 9, 5])).toBe(9);
  });

  it("skips missing figures", () => {
    expect(comparisonScaleMax([null, 4, null])).toBe(4);
  });

  it("never drops below the floor", () => {
    expect(comparisonScaleMax([0, null])).toBe(1);
    expect(comparisonScaleMax([], 100)).toBe(100);
  });
});
