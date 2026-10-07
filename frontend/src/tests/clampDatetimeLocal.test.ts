import { describe, expect, it } from "vitest";
import { clampDatetimeLocal } from "@/lib/clampDatetimeLocal";

const NOW = "2026-10-06T14:30";

describe("clampDatetimeLocal", () => {
  it("leaves a time that has already happened alone", () => {
    expect(clampDatetimeLocal("2026-10-06T09:15", NOW)).toBe("2026-10-06T09:15");
  });

  it("allows the current minute itself", () => {
    expect(clampDatetimeLocal(NOW, NOW)).toBe(NOW);
  });

  it("holds a later time today back to now", () => {
    expect(clampDatetimeLocal("2026-10-06T23:59", NOW)).toBe(NOW);
  });

  it("holds a later day back to now", () => {
    expect(clampDatetimeLocal("2026-12-25T08:00", NOW)).toBe(NOW);
  });

  it("compares by time rather than by digits", () => {
    expect(clampDatetimeLocal("2027-01-01T00:00", NOW)).toBe(NOW);
    expect(clampDatetimeLocal("2025-12-31T23:59", NOW)).toBe(
      "2025-12-31T23:59",
    );
  });

  // Mid-edit, not a value to correct.
  it("leaves an empty value empty", () => {
    expect(clampDatetimeLocal("", NOW)).toBe("");
  });

  it("does nothing without a max", () => {
    expect(clampDatetimeLocal("2026-10-06T23:59", "")).toBe(
      "2026-10-06T23:59",
    );
  });
});
