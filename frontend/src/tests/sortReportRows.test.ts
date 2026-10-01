import { describe, expect, it } from "vitest";
import { sortReportRows } from "@/lib/sortReportRows";
import type { ReportTableRow } from "@/types/reportTable";

const row = (id: string, sortKey: string | number): ReportTableRow => ({ id, cells: {}, sortKey });

describe("sortReportRows", () => {
  it("sorts numeric keys ascending", () => {
    const sorted = sortReportRows([row("b", 10), row("a", 2)], "asc");
    expect(sorted.map((r) => r.id)).toEqual(["a", "b"]);
  });

  it("sorts numeric keys descending", () => {
    const sorted = sortReportRows([row("a", 2), row("b", 10)], "desc");
    expect(sorted.map((r) => r.id)).toEqual(["b", "a"]);
  });

  it("sorts string keys alphabetically", () => {
    const sorted = sortReportRows([row("b", "pear"), row("a", "apple")], "asc");
    expect(sorted.map((r) => r.id)).toEqual(["a", "b"]);
  });

  it("does not mutate the input", () => {
    const input = [row("b", 2), row("a", 1)];
    sortReportRows(input, "asc");
    expect(input.map((r) => r.id)).toEqual(["b", "a"]);
  });
});
