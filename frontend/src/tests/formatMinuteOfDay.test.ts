import { describe, expect, it } from "vitest";
import { formatMinuteOfDay } from "@/lib/formatMinuteOfDay";

describe("formatMinuteOfDay", () => {
  it("formats minutes from midnight as a time", () => {
    expect(formatMinuteOfDay(540, "en-US")).toBe("9:00 AM");
    expect(formatMinuteOfDay(17 * 60 + 30, "en-US")).toBe("5:30 PM");
  });

  it("rounds a fractional average", () => {
    expect(formatMinuteOfDay(532.4, "en-US")).toBe("8:52 AM");
  });

  it("wraps past midnight", () => {
    expect(formatMinuteOfDay(1440 + 30, "en-US")).toBe("12:30 AM");
  });
});
