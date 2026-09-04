import { describe, expect, it } from "vitest";
import { formatDuration } from "@/lib/formatDuration";

describe("formatDuration", () => {
  it("formats whole hours with no remaining minutes", () => {
    expect(formatDuration(120)).toBe("2h");
  });

  it("formats minutes under an hour", () => {
    expect(formatDuration(45)).toBe("45m");
  });

  it("formats hours with remaining minutes", () => {
    expect(formatDuration(150)).toBe("2h 30m");
  });

  it("formats zero minutes", () => {
    expect(formatDuration(0)).toBe("0m");
  });
});
