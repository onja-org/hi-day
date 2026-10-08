import { describe, expect, it } from "vitest";
import { formatTimeChange } from "@/lib/formatTimeChange";

describe("formatTimeChange", () => {
  it("signs an addition", () => {
    expect(formatTimeChange(5400)).toBe("+01:30:00");
  });

  it("signs a removal", () => {
    expect(formatTimeChange(-2700)).toBe("-00:45:00");
  });

  it("leaves no change unsigned", () => {
    expect(formatTimeChange(0)).toBe("00:00:00");
  });
});
