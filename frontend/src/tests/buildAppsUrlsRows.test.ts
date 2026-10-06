import { describe, expect, it } from "vitest";
import { buildAppsUrlsRows } from "@/lib/buildAppsUrlsRows";
import { filterAppsUrlsItems } from "@/lib/filterAppsUrlsItems";
import type { AppsUrlsItem } from "@/types/appsUrlsReport";

function item(dateKey: string, projectId: string | null, label: string, seconds: number): AppsUrlsItem {
  return { dateKey, projectId, projectName: projectId ?? "Untracked", label, kind: "app", seconds };
}

const items = [
  item("2026-10-05", "p1", "Slack", 600),
  item("2026-10-05", "p1", "Slack", 200),
  item("2026-10-05", "p1", "Code", 200),
  item("2026-10-06", "p2", "Code", 60),
];

describe("buildAppsUrlsRows", () => {
  it("groups by date and merges repeats into percent-of-day sub rows, largest first", () => {
    const rows = buildAppsUrlsRows(items, "date", "Ana");
    expect(rows).toHaveLength(2);
    expect(rows[0].cells.time).toBe("00:16:40");
    expect(rows[0].subRows?.map((row) => [row.cells.app, row.cells.time, row.cells.percent])).toEqual([
      ["Slack", "00:13:20", "80%"],
      ["Code", "00:03:20", "20%"],
    ]);
  });

  it("shows a repeated project and member only on the first row of the run", () => {
    const [first] = buildAppsUrlsRows(items, "date", "Ana");
    expect(first.subRows?.map((row) => [row.cells.project, row.cells.member])).toEqual([
      ["p1", "Ana"],
      ["", ""],
    ]);
  });

  it("puts the member on every sub row", () => {
    const [first] = buildAppsUrlsRows(items, "date", "Ana");
    expect(first.subRows?.[0].cells.member).toBe("Ana");
  });

  it("groups by member into a single group of all the time", () => {
    const rows = buildAppsUrlsRows(items, "member", "Ana");
    expect(rows).toHaveLength(1);
    expect(rows[0].cells.group).toBe("Ana");
    expect(rows[0].cells.time).toBe("00:17:40");
  });

  it("leaves the grouped dimension out of the sub rows", () => {
    const [first] = buildAppsUrlsRows(items, "member", "Ana");
    expect(first.subRows?.[0].cells).not.toHaveProperty("member");
    expect(first.subRows?.[0].cells).toHaveProperty("date");
  });
});

describe("filterAppsUrlsItems", () => {
  it("narrows by project and by search text", () => {
    expect(filterAppsUrlsItems(items, ["p2"], "")).toHaveLength(1);
    expect(filterAppsUrlsItems(items, [], "slack")).toHaveLength(2);
    expect(filterAppsUrlsItems(items, [], "")).toHaveLength(4);
  });
});
