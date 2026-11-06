import { describe, expect, it } from "vitest";
import { getPageCount } from "@/lib/getPageCount";

describe("getPageCount", () => {
  it("counts a partly-filled last page as a page", () => {
    expect(getPageCount(17, 8)).toBe(3);
  });

  it("does not add a page for an exact fit", () => {
    expect(getPageCount(16, 8)).toBe(2);
  });

  it("is one page for an empty list", () => {
    expect(getPageCount(0, 8)).toBe(1);
  });

  it("is one page for a nonsensical page size rather than dividing by zero", () => {
    expect(getPageCount(10, 0)).toBe(1);
  });
});
