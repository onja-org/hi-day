import { describe, expect, it } from "vitest";
import { reportFilenameBase } from "@/lib/reportFilenameBase";

describe("reportFilenameBase", () => {
  it("joins the slug and the range's local days", () => {
    const range = { from: new Date(2026, 9, 5), to: new Date(2026, 9, 11, 23, 59, 59, 999) };
    expect(reportFilenameBase("daily-totals", range)).toBe("daily-totals-2026-10-05-to-2026-10-11");
  });
});
