import { describe, expect, it } from "vitest";
import { buildPageList } from "@/lib/buildPageList";

describe("buildPageList", () => {
  it("lists every page when they all fit", () => {
    expect(buildPageList(3, 7)).toEqual([1, 2, 3, 4, 5, 6, 7]);
  });

  it("lists the single page of a one-page list", () => {
    expect(buildPageList(1, 1)).toEqual([1]);
  });

  it("is page 1 alone for an empty list", () => {
    expect(buildPageList(1, 0)).toEqual([1]);
  });

  it("shows the opening pages near the start", () => {
    expect(buildPageList(1, 12)).toEqual([1, 2, 3, 4, 5, "gap", 12]);
  });

  // A gap standing in for page 2 alone would take a slot and hide a page.
  it("shows page 2 rather than a gap hiding only page 2", () => {
    expect(buildPageList(4, 12)).toEqual([1, 2, 3, 4, 5, "gap", 12]);
  });

  it("puts the current page between two gaps in the middle", () => {
    expect(buildPageList(6, 12)).toEqual([1, "gap", 5, 6, 7, "gap", 12]);
  });

  it("shows the closing pages near the end", () => {
    expect(buildPageList(9, 12)).toEqual([1, "gap", 8, 9, 10, 11, 12]);
    expect(buildPageList(12, 12)).toEqual([1, "gap", 8, 9, 10, 11, 12]);
  });

  it("never uses more than seven slots", () => {
    for (let page = 1; page <= 50; page += 1) {
      expect(buildPageList(page, 50).length).toBeLessThanOrEqual(7);
    }
  });

  it("always includes the current, first and last page", () => {
    for (let page = 1; page <= 30; page += 1) {
      const list = buildPageList(page, 30);
      expect(list).toContain(page);
      expect(list[0]).toBe(1);
      expect(list.at(-1)).toBe(30);
    }
  });

  it("treats a page out of range as the nearest real page", () => {
    expect(buildPageList(99, 12)).toEqual(buildPageList(12, 12));
    expect(buildPageList(0, 12)).toEqual(buildPageList(1, 12));
  });
});
