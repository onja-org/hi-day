import { describe, expect, it } from "vitest";
import { splitOnMatch } from "@/lib/splitOnMatch";

describe("splitOnMatch", () => {
  it("returns the whole label unmatched when the query is empty", () => {
    expect(splitOnMatch("Client X migration", "")).toEqual([
      { text: "Client X migration", matched: false },
    ]);
  });

  it("returns the whole label unmatched when nothing matches", () => {
    expect(splitOnMatch("Client X migration", "zzz")).toEqual([
      { text: "Client X migration", matched: false },
    ]);
  });

  it("splits out a prefix match", () => {
    expect(splitOnMatch("Client X migration", "Cl")).toEqual([
      { text: "Cl", matched: true },
      { text: "ient X migration", matched: false },
    ]);
  });

  it("splits out a mid-string match, case-insensitively", () => {
    expect(splitOnMatch("Mada coffee e-shop", "C")).toEqual([
      { text: "Mada ", matched: false },
      { text: "c", matched: true },
      { text: "offee e-shop", matched: false },
    ]);
  });

  it("drops empty segments when the match spans the whole label", () => {
    expect(splitOnMatch("dev", "dev")).toEqual([{ text: "dev", matched: true }]);
  });
});
