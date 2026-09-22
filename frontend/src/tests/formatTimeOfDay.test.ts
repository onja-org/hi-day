import { describe, expect, it } from "vitest";
import { formatTimeOfDay } from "@/lib/formatTimeOfDay";

describe("formatTimeOfDay", () => {
  it("formats a morning time with minutes", () => {
    expect(formatTimeOfDay(new Date(2026, 0, 1, 9, 14))).toBe("09:14 AM");
  });

  it("formats an afternoon time with minutes", () => {
    expect(formatTimeOfDay(new Date(2026, 0, 1, 12, 31))).toBe("12:31 PM");
  });

  it("formats midnight as 12 AM", () => {
    expect(formatTimeOfDay(new Date(2026, 0, 1, 0, 0))).toBe("12:00 AM");
  });

  it("formats noon as 12 PM", () => {
    expect(formatTimeOfDay(new Date(2026, 0, 1, 12, 0))).toBe("12:00 PM");
  });

  it("pads single-digit minutes", () => {
    expect(formatTimeOfDay(new Date(2026, 0, 1, 15, 5))).toBe("03:05 PM");
  });
});
