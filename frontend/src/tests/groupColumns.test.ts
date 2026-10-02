import { describe, expect, it } from "vitest";
import { groupColumns } from "@/lib/groupColumns";

describe("groupColumns", () => {
  it("buckets columns by group in first-seen order", () => {
    const result = groupColumns([
      { key: "a", header: "A", group: "One" },
      { key: "b", header: "B", group: "Two" },
      { key: "c", header: "C", group: "One" },
    ]);
    expect(result.map((g) => [g.group, g.columns.map((c) => c.key)])).toEqual([
      ["One", ["a", "c"]],
      ["Two", ["b"]],
    ]);
  });

  it("keeps ungrouped columns together", () => {
    const result = groupColumns([
      { key: "a", header: "A" },
      { key: "b", header: "B" },
    ]);
    expect(result).toHaveLength(1);
    expect(result[0].group).toBeUndefined();
  });
});
