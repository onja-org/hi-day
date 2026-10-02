import { describe, expect, it } from "vitest";
import { timeActivityColumns } from "@/lib/timeActivityReportConfig";

const keys = (grouping: Parameters<typeof timeActivityColumns>[0]) =>
  timeActivityColumns(grouping).map((column) => column.key);

describe("timeActivityColumns", () => {
  it("drops the Team column when grouped by team", () => {
    expect(keys("team")).not.toContain("team");
    expect(keys("team")).toContain("project");
  });

  it("drops the Project column when grouped by project", () => {
    expect(keys("project")).not.toContain("project");
    expect(keys("project")).toContain("team");
  });

  it("keeps both for other groupings", () => {
    expect(keys("day")).toEqual(expect.arrayContaining(["project", "team"]));
  });

  it("adds a separate Date column only for none", () => {
    expect(keys("none")).toContain("when");
    expect(keys("day")).not.toContain("when");
  });

  it("names the first column after the grouping", () => {
    expect(timeActivityColumns("team")[0].header).toBe("Team");
    expect(timeActivityColumns("project")[0].header).toBe("Project / Work order");
  });
});
