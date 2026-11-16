import { describe, expect, it } from "vitest";
import { describeComparisonPeriods } from "@/lib/describeComparisonPeriods";

describe("describeComparisonPeriods", () => {
  it("names weeks and days", () => {
    expect(describeComparisonPeriods(7, 3)).toBe("the previous 3 weeks");
    expect(describeComparisonPeriods(1, 3)).toBe("the previous 3 days");
  });

  it("gives the length of any other period", () => {
    expect(describeComparisonPeriods(10, 3)).toBe("the previous 3 periods of 10 days");
  });
});
