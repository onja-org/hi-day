import jsPDF from "jspdf";
import { autoTable } from "jspdf-autotable";
import { describe, expect, it } from "vitest";
import { buildColumnStyles, toPdfBlob } from "@/lib/toPdfBlob";

describe("toPdfBlob", () => {
  it("returns a non-empty PDF blob for a titled table", () => {
    const blob = toPdfBlob("Report", ["A", "B"], [["1", "2"]]);

    expect(blob).toBeInstanceOf(Blob);
    expect(blob.type).toBe("application/pdf");
    expect(blob.size).toBeGreaterThan(0);
  });

  it("still returns a valid blob for an empty table", () => {
    const blob = toPdfBlob("Empty report", ["A"], []);

    expect(blob).toBeInstanceOf(Blob);
    expect(blob.size).toBeGreaterThan(0);
  });

  it("still returns a valid blob when wideColumnWidths pins a column", () => {
    const blob = toPdfBlob("Report", ["A", "B"], [["1", "2"]], { 1: 55 });

    expect(blob).toBeInstanceOf(Blob);
    expect(blob.size).toBeGreaterThan(0);
  });
});

describe("buildColumnStyles", () => {
  it("wraps each pinned width as a cellWidth column style, keyed by index", () => {
    expect(buildColumnStyles({ 2: 55, 3: 45 })).toEqual({
      2: { cellWidth: 55 },
      3: { cellWidth: 45 },
    });
  });

  it("returns an empty object for no pinned columns", () => {
    expect(buildColumnStyles({})).toEqual({});
  });
});

// A single long, unbreakable "word" (a URL has no spaces to wrap at) left to
// autoTable's default "auto" column sizing claims almost the whole table
// width to fit its longest value on one line, squeezing every other column
// down to a sliver that then wraps one character per line. This measures
// each column's actual rendered width (via autoTable's own `didDrawCell`
// hook) to confirm `buildColumnStyles`'s pinning keeps every column at a
// readable width, which is the regression `toPdfBlob`'s Blob-only return
// can't directly assert on.
describe("column width regression (the bug this session hit)", () => {
  const unbreakableUrl =
    "https://www.example.com/some/very/long/path/segment/that/never/breaks" +
    "?utm_source=newsletter&utm_medium=email&utm_campaign=q3_launch&token=abc123def456ghi789";
  const header = ["Hour", "Project", "URL", "Title", "Time spent", "Sessions"];
  const row = [
    "9/17/26, 9:00 AM",
    "dev",
    unbreakableUrl,
    "Some page title text",
    "01:00:00",
    "1",
  ];
  const MIN_READABLE_WIDTH_MM = 10;

  function renderedColumnWidths(columnStyles: Record<number, { cellWidth: number }>): number[] {
    const doc = new jsPDF();
    const widths: number[] = [];
    autoTable(doc, {
      head: [header],
      body: [row],
      startY: 20,
      styles: { fontSize: 8 },
      columnStyles,
      didDrawCell: (data) => {
        if (data.row.index === 0 && data.section === "body") {
          widths[data.column.index] = data.cell.width;
        }
      },
    });
    return widths;
  }

  it("squeezes the other columns unreadably narrow when the URL column is left unpinned", () => {
    const widths = renderedColumnWidths(buildColumnStyles({}));

    expect(Math.min(...widths)).toBeLessThan(MIN_READABLE_WIDTH_MM);
  });

  it("keeps every column at a readable width once the URL/Title columns are pinned", () => {
    const widths = renderedColumnWidths(buildColumnStyles({ 2: 55, 3: 45 }));

    for (const width of widths) {
      expect(width).toBeGreaterThanOrEqual(MIN_READABLE_WIDTH_MM);
    }
  });
});
