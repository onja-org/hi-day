import { describe, expect, it } from "vitest";
import { describePageRange } from "@/lib/describePageRange";

describe("describePageRange", () => {
  it("describes a full page", () => {
    expect(describePageRange(2, 8, 40)).toBe("9–16 of 40");
  });

  it("stops a short last page at the total", () => {
    expect(describePageRange(3, 8, 17)).toBe("17–17 of 17");
  });

  it("describes the first page", () => {
    expect(describePageRange(1, 8, 5)).toBe("1–5 of 5");
  });

  it("says nothing is shown for an empty list", () => {
    expect(describePageRange(1, 8, 0)).toBe("0 of 0");
  });
});
