import { describe, expect, it } from "vitest";
import { filterAppsUrlsItems } from "@/lib/filterAppsUrlsItems";
import type { AppsUrlsItem } from "@/types/appsUrlsReport";

function item(overrides: Partial<AppsUrlsItem>): AppsUrlsItem {
  return {
    dateKey: "2026-10-05",
    projectId: "p1",
    projectName: "Website",
    label: "Figma",
    kind: "app",
    seconds: 60,
    ...overrides,
  };
}

const items = [
  item({ label: "Figma" }),
  item({ label: "github.com", kind: "site", projectId: "p2", projectName: "Mobile" }),
  item({ label: "Slack", projectId: null, projectName: "Untracked" }),
];

describe("filterAppsUrlsItems", () => {
  it("keeps everything when no project or search is set", () => {
    expect(filterAppsUrlsItems(items, [], "  ")).toEqual(items);
  });

  it("keeps only items in the chosen projects, dropping untracked ones", () => {
    expect(filterAppsUrlsItems(items, ["p1", "p2"], "").map((i) => i.label)).toEqual(["Figma", "github.com"]);
  });

  it("matches the search against the label, case-insensitively", () => {
    expect(filterAppsUrlsItems(items, [], " GIT ").map((i) => i.label)).toEqual(["github.com"]);
  });

  it("matches the search against the project name", () => {
    expect(filterAppsUrlsItems(items, [], "mobile").map((i) => i.label)).toEqual(["github.com"]);
  });

  it("combines the project and search filters", () => {
    expect(filterAppsUrlsItems(items, ["p1"], "mobile")).toEqual([]);
  });
});
