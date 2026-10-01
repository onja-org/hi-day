import { describe, expect, it } from "vitest";
import { flattenReportRows } from "@/lib/flattenReportRows";
import type { ReportTableColumn, ReportTableRow } from "@/types/reportTable";

const columns: ReportTableColumn[] = [
  { key: "date", header: "Date" },
  { key: "team", header: "Team" },
  { key: "total", header: "Total" },
];

describe("flattenReportRows", () => {
  it("returns the headers and one line per row, children under their parent and indented", () => {
    const rows: ReportTableRow[] = [
      {
        id: "a",
        sortKey: 1,
        cells: { date: "Mon (1)", total: "01:00:00" },
        teams: ["Dev", "Design"],
        subRows: [{ id: "a1", sortKey: 2, cells: { date: "Ada", team: "Dev", total: "01:00:00" } }],
      },
    ];
    expect(flattenReportRows(columns, rows)).toEqual({
      header: ["Date", "Team", "Total"],
      body: [
        ["Mon (1)", "Dev, Design", "01:00:00"],
        ["    Ada", "Dev", "01:00:00"],
      ],
    });
  });

  it("shows a dash for a missing cell and for a row with no teams", () => {
    const rows: ReportTableRow[] = [{ id: "a", sortKey: 1, cells: { date: "Mon" }, teams: [] }];
    expect(flattenReportRows(columns, rows).body).toEqual([["Mon", "-", "-"]]);
  });
});
