import { describe, expect, it } from "vitest";
import { workTimeShares } from "@/lib/workTimeShares";

describe("workTimeShares", () => {
  it("splits time into whole percentages", () => {
    expect(workTimeShares({ coreSeconds: 300, nonCoreSeconds: 100, unclassifiedSeconds: 100 })).toEqual({
      core: 60,
      nonCore: 20,
      unclassified: 20,
    });
  });

  it("always adds up to 100", () => {
    const shares = workTimeShares({ coreSeconds: 1, nonCoreSeconds: 1, unclassifiedSeconds: 1 });
    expect(shares.core + shares.nonCore + shares.unclassified).toBe(100);
  });

  it("is all zero with no time", () => {
    expect(workTimeShares({ coreSeconds: 0, nonCoreSeconds: 0, unclassifiedSeconds: 0 })).toEqual({
      core: 0,
      nonCore: 0,
      unclassified: 0,
    });
  });
});
