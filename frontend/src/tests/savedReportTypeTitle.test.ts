import { describe, expect, it } from "vitest";
import { savedReportTypeTitle } from "@/lib/savedReportTypeTitle";

describe("savedReportTypeTitle", () => {
  it("names each saved report by the report it was made from", () => {
    expect(savedReportTypeTitle("time-and-activity")).toBe("Time & activity");
    expect(savedReportTypeTitle("daily-totals")).toBe("Daily totals");
    expect(savedReportTypeTitle("manual-time-edits")).toBe("Manual time edits");
  });
});
