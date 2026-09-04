import { describe, expect, it } from "vitest";
import { toDatetimeLocalValue } from "@/lib/toDatetimeLocalValue";

describe("toDatetimeLocalValue", () => {
  it("formats an ISO instant as the viewer's local wall-clock value", () => {
    // Built from local components (not parsed from a UTC string), so this
    // test is independent of the machine's own timezone.
    const local = new Date(2026, 0, 5, 9, 30);

    expect(toDatetimeLocalValue(local.toISOString())).toBe("2026-01-05T09:30");
  });

  it("pads single-digit month, day, hour, and minute", () => {
    const local = new Date(2026, 2, 4, 6, 5);

    expect(toDatetimeLocalValue(local.toISOString())).toBe("2026-03-04T06:05");
  });
});
