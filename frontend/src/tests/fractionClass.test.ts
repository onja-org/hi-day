import { describe, expect, it } from "vitest";
import { fractionClass } from "@/lib/fractionClass";

describe("fractionClass", () => {
  it("snaps a width ratio to the nearest Tailwind fraction class", () => {
    expect(fractionClass("w", 0)).toBe("w-0");
    expect(fractionClass("w", 1)).toBe("w-full");
    expect(fractionClass("w", 0.5)).toBe("w-1/2");
    expect(fractionClass("w", 0.4)).toBe("w-5/12");
  });

  it("snaps a height ratio to the nearest Tailwind fraction class", () => {
    expect(fractionClass("h", 0)).toBe("h-0");
    expect(fractionClass("h", 1)).toBe("h-full");
    expect(fractionClass("h", 2 / 3)).toBe("h-2/3");
  });

  it("clamps ratios outside 0-1", () => {
    expect(fractionClass("w", -0.5)).toBe("w-0");
    expect(fractionClass("w", 1.5)).toBe("w-full");
  });
});
