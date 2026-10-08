import { describe, expect, it } from "vitest";
import { formatEditTimespan } from "@/lib/formatEditTimespan";

describe("formatEditTimespan", () => {
  it("reads the span in the given zone", () => {
    const text = formatEditTimespan("2026-10-05T08:00:00.000Z", "2026-10-05T09:30:00.000Z", "UTC");
    expect(text).toContain("Oct 5");
    expect(text).toMatch(/8:00/);
    expect(text).toMatch(/9:30/);
  });

  it("shifts the day with the zone", () => {
    const text = formatEditTimespan("2026-10-05T23:30:00.000Z", "2026-10-06T00:30:00.000Z", "Africa/Nairobi");
    expect(text).toContain("Oct 6");
  });

  it("marks an open end", () => {
    expect(formatEditTimespan("2026-10-05T08:00:00.000Z", null, "UTC")).toContain("In progress");
  });

  it("shows a dash when there is no span", () => {
    expect(formatEditTimespan(null, null, "UTC")).toBe("-");
  });
});
