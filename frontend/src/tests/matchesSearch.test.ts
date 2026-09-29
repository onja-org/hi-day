import { describe, expect, it } from "vitest";
import { matchesSearch } from "@/lib/matchesSearch";

describe("matchesSearch", () => {
  it("matches everything for a blank search", () => {
    expect(matchesSearch(["Ada"], "   ")).toBe(true);
  });

  it("matches a case-insensitive substring of any field", () => {
    expect(matchesSearch(["Ada Lovelace", "ada@example.com"], "EXAMPLE")).toBe(true);
  });

  it("skips null fields", () => {
    expect(matchesSearch([null, "grace@example.com"], "grace")).toBe(true);
    expect(matchesSearch([null], "grace")).toBe(false);
  });

  it("returns false when no field matches", () => {
    expect(matchesSearch(["Ada", "ada@example.com"], "turing")).toBe(false);
  });
});
