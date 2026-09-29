import { describe, expect, it } from "vitest";
import { getInitials } from "@/lib/getInitials";

describe("getInitials", () => {
  it("uses the first and last word of a multi-word name", () => {
    expect(getInitials("ada byron lovelace")).toBe("AL");
  });

  it("uses a single letter for a one-word name", () => {
    expect(getInitials("Ada")).toBe("A");
  });

  it("falls back to the first letter of the fallback when there's no name", () => {
    expect(getInitials(null, "grace@example.com")).toBe("G");
    expect(getInitials("   ", "grace@example.com")).toBe("G");
  });

  it("returns an empty string when there's nothing to use", () => {
    expect(getInitials(null)).toBe("");
  });
});
