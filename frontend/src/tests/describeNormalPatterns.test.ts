import { describe, expect, it } from "vitest";
import { describeNormalPatterns } from "@/lib/describeNormalPatterns";

describe("describeNormalPatterns", () => {
  it("says nothing when no pattern was skipped", () => {
    expect(describeNormalPatterns([], false)).toBeNull();
  });

  it("names each skipped pattern for a manager", () => {
    expect(describeNormalPatterns(["consistent_activity", "high_activity"], false)).toBe(
      "Not flagged, because it's this member's usual way of working (5 or more of the previous 30 days): activity that barely moves and activity at 95% or more.",
    );
  });

  it("speaks to the member on their own page", () => {
    expect(describeNormalPatterns(["breakless_work"], true)).toBe(
      "Not flagged, because it's your usual way of working (5 or more of the previous 30 days): five hours or more without a break.",
    );
  });
});
