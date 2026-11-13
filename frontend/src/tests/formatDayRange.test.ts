import { describe, expect, it } from "vitest";
import { formatDayRange } from "@/lib/formatDayRange";

describe("formatDayRange", () => {
  it("shows both ends of a range", () => {
    expect(formatDayRange("2026-10-12", "2026-11-01")).toBe("Oct 12 – Nov 1");
  });

  it("shows a single day once", () => {
    expect(formatDayRange("2026-11-01", "2026-11-01")).toBe("Nov 1");
  });
});
