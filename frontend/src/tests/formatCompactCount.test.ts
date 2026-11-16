import { describe, expect, it } from "vitest";
import { formatCompactCount } from "@/lib/formatCompactCount";

describe("formatCompactCount", () => {
  it("shows small counts in full", () => {
    expect(formatCompactCount(0)).toBe("0");
    expect(formatCompactCount(412)).toBe("412");
    expect(formatCompactCount(999)).toBe("999");
  });

  it("shortens thousands with one decimal, dropping a trailing .0", () => {
    expect(formatCompactCount(1000)).toBe("1k");
    expect(formatCompactCount(1240)).toBe("1.2k");
    expect(formatCompactCount(18_400)).toBe("18.4k");
    expect(formatCompactCount(240_500)).toBe("241k");
  });

  it("shortens millions", () => {
    expect(formatCompactCount(3_120_000)).toBe("3.1M");
  });
});
