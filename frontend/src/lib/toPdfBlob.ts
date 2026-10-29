import jsPDF from "jspdf";
import { autoTable } from "jspdf-autotable";

/** Translates the simple `{ columnIndex: widthInMm }` shape this module's
 * callers use into autoTable's own `columnStyles` shape. */
export function buildColumnStyles(
  wideColumnWidths: Record<number, number>,
): Record<number, { cellWidth: number }> {
  return Object.fromEntries(
    Object.entries(wideColumnWidths).map(([index, width]) => [index, { cellWidth: width }]),
  );
}

/**
 * `wideColumnWidths` pins specific columns (by index) to a fixed width in
 * mm — needed for any column that can hold a single long, unbreakable
 * "word" (a URL, an untruncated page title). Left to autoTable's default
 * `cellWidth: "auto"`, one such column claims almost the entire table
 * width to fit its longest value on one line, squeezing every other
 * column down to a sliver that then wraps one character per line. Pinning
 * the risky column(s) removes them from that proportional-shrink pool, so
 * the remaining "auto" columns keep sensible, readable widths.
 */
export function toPdfBlob(
  title: string,
  header: string[],
  rows: string[][],
  wideColumnWidths: Record<number, number> = {},
  /** Small underlined line above the title, e.g. a report's date range. */
  subtitle?: string,
  /** Sets the last row in bold, for a table that ends in a total. */
  boldLastRow = false,
): Blob {
  // Past a handful of columns (a week of days) portrait squeezes cells into wrapping.
  const doc = new jsPDF({ orientation: header.length > 6 ? "landscape" : "portrait" });
  const pageWidth = doc.internal.pageSize.getWidth();
  if (subtitle) {
    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.text(subtitle, 14, 15);
    doc.line(14, 16.5, 14 + doc.getTextWidth(subtitle), 16.5);
  }
  doc.setFontSize(subtitle ? 18 : 14);
  doc.setFont("helvetica", "bold");
  doc.text(title, subtitle ? pageWidth / 2 : 14, subtitle ? 28 : 15, { align: subtitle ? "center" : "left" });
  autoTable(doc, {
    head: [header],
    body: rows,
    startY: subtitle ? 38 : 20,
    theme: "plain",
    styles: { fontSize: 8, cellPadding: 2.5, lineColor: [228, 228, 228], lineWidth: 0 },
    headStyles: { fontStyle: "bold" },
    columnStyles: buildColumnStyles(wideColumnWidths),
    didParseCell: ({ section, row, cell }) => {
      if (boldLastRow && section === "body" && row.index === rows.length - 1) cell.styles.fontStyle = "bold";
    },
    // Plain theme has no rules; a light line under each cell gives the row dividers.
    didDrawCell: ({ doc: pdf, cell }) => {
      pdf.setDrawColor(228, 228, 228);
      pdf.setLineWidth(0.2);
      pdf.line(cell.x, cell.y + cell.height, cell.x + cell.width, cell.y + cell.height);
    },
  });
  return doc.output("blob");
}
