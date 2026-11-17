import { describe, expect, it } from "vitest";
import { daysBetweenKeys } from "@/lib/daysBetweenKeys";

describe("daysBetweenKeys", () => {
  it("counts forward and backward", () => {
    expect(daysBetweenKeys("2026-11-12", "2026-11-10")).toBe(-2);
    expect(daysBetweenKeys("2026-11-10", "2026-11-12")).toBe(2);
    expect(daysBetweenKeys("2026-11-10", "2026-11-10")).toBe(0);
  });

  it("is unaffected by a daylight-saving change in between", () => {
    // US clocks went back on 1 Nov 2026; Europe's on 25 Oct.
    expect(daysBetweenKeys("2026-10-24", "2026-11-02")).toBe(9);
  });

  it("crosses a year end", () => {
    expect(daysBetweenKeys("2026-12-31", "2027-01-01")).toBe(1);
  });
});
