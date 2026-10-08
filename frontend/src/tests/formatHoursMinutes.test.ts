import { describe, expect, it } from "vitest";
import { formatHoursMinutes } from "@/lib/formatHoursMinutes";

describe("formatHoursMinutes", () => {
  it("pads minutes but not hours", () => {
    expect(formatHoursMinutes(4 * 3600 + 30 * 60)).toBe("4:30");
    expect(formatHoursMinutes(40 * 60)).toBe("0:40");
    expect(formatHoursMinutes(5 * 60)).toBe("0:05");
  });

  it("goes past 24 hours rather than wrapping", () => {
    expect(formatHoursMinutes(31 * 3600 + 20 * 60)).toBe("31:20");
  });

  it("rounds partial minutes down", () => {
    expect(formatHoursMinutes(59)).toBe("0:00");
    expect(formatHoursMinutes(3599)).toBe("0:59");
  });

  it("treats negative input as zero", () => {
    expect(formatHoursMinutes(-120)).toBe("0:00");
  });
});
