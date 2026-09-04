import { describe, expect, it } from "vitest";
import { formatElapsed } from "@/lib/formatElapsed";

describe("formatElapsed", () => {
  it("formats zero as 00:00:00", () => {
    expect(formatElapsed(0)).toBe("00:00:00");
  });

  it("formats seconds under a minute", () => {
    expect(formatElapsed(45_000)).toBe("00:00:45");
  });

  it("formats minutes and seconds", () => {
    expect(formatElapsed(65_000)).toBe("00:01:05");
  });

  it("formats hours, minutes, and seconds", () => {
    expect(formatElapsed(3_661_000)).toBe("01:01:01");
  });

  it("floors partial seconds instead of rounding", () => {
    expect(formatElapsed(1_999)).toBe("00:00:01");
  });

  it("clamps negative values (e.g. clock skew) to zero", () => {
    expect(formatElapsed(-5000)).toBe("00:00:00");
  });
});
