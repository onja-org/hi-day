import { describe, expect, it } from "vitest";
import { filterWorkUsage } from "@/lib/filterWorkUsage";
import type { WorkUsageItem } from "@/types/workClassification";

const items: WorkUsageItem[] = [
  { kind: "site", name: "github.com", secondsSpent: 900, label: "core" },
  { kind: "app", name: "Code", secondsSpent: 600, label: "unclassified" },
  { kind: "site", name: "youtube.com", secondsSpent: 300, label: "non_core" },
];
const names = (list: WorkUsageItem[]) => list.map((item) => item.name);

describe("filterWorkUsage", () => {
  it("keeps everything with no filter, in order", () => {
    expect(names(filterWorkUsage(items, { kind: "all", label: "all", search: "" }))).toEqual([
      "github.com",
      "Code",
      "youtube.com",
    ]);
  });

  it("narrows by kind and label", () => {
    expect(names(filterWorkUsage(items, { kind: "site", label: "all", search: "" }))).toEqual([
      "github.com",
      "youtube.com",
    ]);
    expect(names(filterWorkUsage(items, { kind: "all", label: "unclassified", search: "" }))).toEqual(["Code"]);
  });

  it("searches names ignoring case", () => {
    expect(names(filterWorkUsage(items, { kind: "all", label: "all", search: " CODE " }))).toEqual(["Code"]);
  });
});
