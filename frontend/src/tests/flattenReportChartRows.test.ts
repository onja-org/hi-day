import { describe, expect, it } from "vitest";
import { flattenReportChartRows } from "@/lib/flattenReportChartRows";

const series = [
  { key: "tracked", label: "Tracked", color: "red" },
  { key: "manual", label: "Manual", color: "blue" },
];

describe("flattenReportChartRows", () => {
  it("spreads each row's values next to its label", () => {
    expect(
      flattenReportChartRows([{ label: "Mon", values: { tracked: 60, manual: 30 } }], series),
    ).toEqual([{ label: "Mon", tracked: 60, manual: 30 }]);
  });

  it("fills a missing series with 0", () => {
    expect(flattenReportChartRows([{ label: "Tue", values: { tracked: 60 } }], series)).toEqual([
      { label: "Tue", tracked: 60, manual: 0 },
    ]);
  });

  it("drops values for series that aren't listed", () => {
    expect(flattenReportChartRows([{ label: "Wed", values: { other: 5 } }], series)).toEqual([
      { label: "Wed", tracked: 0, manual: 0 },
    ]);
  });
});
