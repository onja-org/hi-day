import { describe, expect, it } from "vitest";
import { diffIdSets } from "@/lib/diffIdSets";

describe("diffIdSets", () => {
  it("lists ids only in the target as additions and only in the original as removals", () => {
    expect(diffIdSets(["a", "b"], ["b", "c"])).toEqual({ toAdd: ["c"], toRemove: ["a"] });
  });

  it("returns nothing to do when the sets match, ignoring order and duplicates", () => {
    expect(diffIdSets(["a", "b", "a"], ["b", "a"])).toEqual({ toAdd: [], toRemove: [] });
  });
});
