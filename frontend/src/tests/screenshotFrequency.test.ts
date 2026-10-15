import { describe, expect, it } from "vitest";
import {
  perPeriodFromSeconds,
  secondsFromPerPeriod,
} from "@/lib/screenshotFrequency";

describe("screenshotFrequency", () => {
  it("round-trips every option the picker offers", () => {
    for (const perPeriod of ["0", "1", "2", "3"]) {
      expect(perPeriodFromSeconds(secondsFromPerPeriod(perPeriod))).toBe(
        perPeriod,
      );
    }
  });

  it("treats a non-positive interval as None", () => {
    expect(perPeriodFromSeconds(0)).toBe("0");
    expect(secondsFromPerPeriod("0")).toBe(0);
  });

  it("rounds an interval the options don't name to the nearest they do", () => {
    // 7 minutes is between 1 and 2 per period, and closer to 1.
    expect(perPeriodFromSeconds(420)).toBe("1");
    // Faster than the shortest option still lands on it, never above.
    expect(perPeriodFromSeconds(30)).toBe("3");
  });
});
