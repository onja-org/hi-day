import { describe, expect, it } from "vitest";
import { paginateRows } from "@/lib/paginateRows";

describe("paginateRows", () => {
  const items = [1, 2, 3, 4, 5];

  it("returns the first page", () => {
    expect(paginateRows(items, 1, 2)).toEqual([1, 2]);
  });

  it("returns a short last page", () => {
    expect(paginateRows(items, 3, 2)).toEqual([5]);
  });

  it("returns nothing past the last page", () => {
    expect(paginateRows(items, 4, 2)).toEqual([]);
  });
});
