import { describe, expect, it } from "vitest";
import { reportTableToCsv } from "@/lib/reportTableToCsv";
import type { ReportTableColumn, ReportTableRow } from "@/types/reportTable";

const columns: ReportTableColumn[] = [
  { key: "name", header: "Name" },
  { key: "hours", header: "Hours" },
];

describe("reportTableToCsv", () => {
  it("writes the headers then one line per row", () => {
    const rows: ReportTableRow[] = [
      { id: "a", sortKey: 1, cells: { name: "Ada", hours: "01:00" } },
      { id: "b", sortKey: 2, cells: { name: "Bo", hours: 2 } },
    ];
    expect(reportTableToCsv(columns, rows)).toBe("Name,Hours\nAda,01:00\nBo,2");
  });

  it("writes nested rows directly beneath their parent, indented", () => {
    const rows: ReportTableRow[] = [
      {
        id: "a",
        sortKey: 1,
        cells: { name: "Day", hours: "02:00" },
        subRows: [{ id: "a1", sortKey: 1, cells: { name: "Ada", hours: "02:00" } }],
      },
    ];
    expect(reportTableToCsv(columns, rows)).toBe("Name,Hours\nDay,02:00\n    Ada,02:00");
  });

  it('writes a missing cell as "-" (formula-escaped by toCsvString) and quotes values with commas', () => {
    const rows: ReportTableRow[] = [{ id: "a", sortKey: 1, cells: { name: "A, B" } }];
    expect(reportTableToCsv(columns, rows)).toBe('Name,Hours\n"A, B",\'-');
  });
});
