import { describe, expect, it } from "vitest";
import { describeTargetGap } from "@/lib/describeTargetGap";

describe("describeTargetGap", () => {
  it("says how far below target", () => {
    expect(describeTargetGap(3 * 3600 + 24 * 60, 8 * 3600)).toEqual({
      direction: "below",
      label: "Below target by 4:36",
    });
  });

  it("says how far above target", () => {
    expect(describeTargetGap(9 * 3600, 8 * 3600)).toEqual({
      direction: "above",
      label: "Above target by 1:00",
    });
  });

  it("treats under a minute either way as on target", () => {
    expect(describeTargetGap(8 * 3600 - 30, 8 * 3600).direction).toBe("on");
  });
});
