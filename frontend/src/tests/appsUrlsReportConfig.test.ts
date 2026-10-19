import { describe, expect, it } from "vitest";
import { appsUrlsColumns, appsUrlsGroupings } from "@/lib/appsUrlsReportConfig";

describe("appsUrlsColumns", () => {
  it("names the first column after the grouping and leaves its detail column out", () => {
    expect(appsUrlsColumns("date").map((column) => column.header)).toEqual([
      "Date",
      "Project / Work order",
      "Member",
      "App or site",
      "Time spent (hrs)",
      "Percent used",
    ]);
    expect(appsUrlsColumns("project").map((column) => column.header)).toEqual([
      "Project / Work order",
      "Date",
      "Member",
      "App or site",
      "Time spent (hrs)",
      "Percent used",
    ]);
  });

  it("keys the first column as group and the details by their grouping", () => {
    expect(appsUrlsColumns("member").map((column) => column.key)).toEqual(["group", "date", "project", "app", "time", "percent"]);
  });
});

describe("appsUrlsColumns with Projects off", () => {
  it("leaves the project column out", () => {
    expect(appsUrlsColumns("date", false).map((column) => column.header)).toEqual([
      "Date",
      "Member",
      "App or site",
      "Time spent (hrs)",
      "Percent used",
    ]);
  });

  it("offers no project grouping", () => {
    expect(appsUrlsGroupings(false).map((option) => option.value)).toEqual(["date", "member"]);
    expect(appsUrlsGroupings(true).map((option) => option.value)).toEqual(["date", "project", "member"]);
  });
});
