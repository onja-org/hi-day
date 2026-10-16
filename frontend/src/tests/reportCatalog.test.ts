import { describe, expect, it } from "vitest";
import { REPORTS, reportsFor } from "@/lib/reportCatalog";

describe("reportsFor", () => {
  it("lists every report while Projects are on", () => {
    expect(reportsFor(true)).toEqual(REPORTS);
  });

  it("leaves out a report that is a grid of Projects when they are off", () => {
    const ids = reportsFor(false).map((report) => report.id);

    expect(ids).not.toContain("daily-totals");
    expect(ids).toContain("time-and-activity");
  });

  it("stops describing a report in terms of projects when they are off", () => {
    const report = reportsFor(false).find((candidate) => candidate.id === "time-and-activity");

    expect(report?.description).not.toMatch(/project/i);
  });
});
