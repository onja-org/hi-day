import { describe, expect, it } from "vitest";
import { appsUrlsColumns } from "@/lib/appsUrlsReportConfig";

describe("appsUrlsColumns", () => {
  it("names the first column after the grouping and leaves its detail column out", () => {
    expect(appsUrlsColumns("date").map((column) => column.header)).toEqual([
      "Date",
      "Project / Work order",
      "App or site",
      "Time spent (hrs)",
      "Percent used",
    ]);
    expect(appsUrlsColumns("project").map((column) => column.header)).toEqual([
      "Project / Work order",
      "Date",
      "App or site",
      "Time spent (hrs)",
      "Percent used",
    ]);
  });

  it("keys the first column as group and the details by their grouping", () => {
    expect(appsUrlsColumns("app").map((column) => column.key)).toEqual(["group", "date", "project", "time", "percent"]);
  });
});
