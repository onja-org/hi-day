import { describe, expect, it } from "vitest";
import { formatHourLabel } from "@/lib/formatHourLabel";

describe("formatHourLabel", () => {
  it("formats an on-the-hour ISO timestamp as a short local time", () => {
    expect(formatHourLabel("2026-09-18T09:00:00.000Z")).toMatch(/^\d{1,2}:00\s?(AM|PM)?$/i);
  });

  it("keeps the minute component when it isn't zero", () => {
    expect(formatHourLabel("2026-09-18T09:30:00.000Z")).toMatch(/:30/);
  });
});
