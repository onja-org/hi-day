import { describe, expect, it } from "vitest";
import { describeWorkDays } from "@/lib/describeWorkDays";

describe("describeWorkDays", () => {
  it("collapses a contiguous run to a range", () => {
    expect(describeWorkDays([1, 2, 3, 4, 5])).toBe("Mon - Fri");
  });

  it("lists the days when they aren't contiguous", () => {
    expect(describeWorkDays([1, 3, 5])).toBe("Mon, Wed, Fri");
  });

  it("orders from Monday even though Sunday is day 0", () => {
    expect(describeWorkDays([0, 6])).toBe("Sat, Sun");
  });

  it("shows a dash for no days", () => {
    expect(describeWorkDays([])).toBe("-");
  });
});
