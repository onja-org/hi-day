import { describe, expect, it } from "vitest";
import { formatReportRange } from "@/lib/formatReportRange";
import { formatReportDay } from "@/lib/formatReportDay";

describe("formatReportRange", () => {
  it("joins the first and last day, cut in the given zone", () => {
    // 21:00Z is already the next day in Nairobi (UTC+3).
    const range = { from: new Date("2026-10-18T21:00:00Z"), to: new Date("2026-10-25T20:59:59.999Z") };
    expect(formatReportRange(range, "Africa/Nairobi")).toBe(
      `${formatReportDay("2026-10-19")} - ${formatReportDay("2026-10-25")}`,
    );
  });
});
