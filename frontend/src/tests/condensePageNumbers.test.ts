import { describe, expect, it } from "vitest";
import { condensePageNumbers } from "@/lib/condensePageNumbers";

describe("condensePageNumbers", () => {
  it("shows every page when there are only a few", () => {
    expect(condensePageNumbers(1, 3)).toEqual([1, 2, 3]);
  });

  it("shows a single page", () => {
    expect(condensePageNumbers(1, 1)).toEqual([1]);
  });

  it("puts a gap before the last page when on the first", () => {
    expect(condensePageNumbers(1, 100)).toEqual([1, 2, "gap", 100]);
  });

  it("puts a gap after the first page when on the last", () => {
    expect(condensePageNumbers(100, 100)).toEqual([1, "gap", 99, 100]);
  });

  it("puts gaps on both sides of a middle page", () => {
    expect(condensePageNumbers(50, 100)).toEqual([1, "gap", 49, 50, 51, "gap", 100]);
  });

  it("shows the page instead of a gap that would hide only one", () => {
    expect(condensePageNumbers(4, 100)).toEqual([1, 2, 3, 4, 5, "gap", 100]);
  });
});
