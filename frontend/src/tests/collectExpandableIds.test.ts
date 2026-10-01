import { describe, expect, it } from "vitest";
import { collectExpandableIds } from "@/lib/collectExpandableIds";
import type { ReportTableRow } from "@/types/reportTable";

const row = (id: string, subRows?: ReportTableRow[]): ReportTableRow => ({
  id,
  sortKey: id,
  cells: {},
  subRows,
});

describe("collectExpandableIds", () => {
  it("returns nothing for rows without sub-rows", () => {
    expect(collectExpandableIds([row("a"), row("b")])).toEqual([]);
  });

  it("includes parents at every depth but not leaves", () => {
    const rows = [row("a", [row("a1", [row("a1x")]), row("a2")]), row("b")];
    expect(collectExpandableIds(rows)).toEqual(["a", "a1"]);
  });
});
