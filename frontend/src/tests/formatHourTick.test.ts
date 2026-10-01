import { describe, expect, it } from "vitest";
import { formatHourTick } from "@/lib/formatHourTick";

describe("formatHourTick", () => {
  it("formats zero", () => {
    expect(formatHourTick(0)).toBe("0:00");
  });

  it("formats whole hours", () => {
    expect(formatHourTick(9 * 3600)).toBe("9:00");
  });
});
