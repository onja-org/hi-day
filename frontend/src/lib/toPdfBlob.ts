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
): Blob {
  const doc = new jsPDF();
  doc.setFontSize(14);
  doc.text(title, 14, 15);
  autoTable(doc, {
    head: [header],
    body: rows,
    startY: 20,
    styles: { fontSize: 8 },
    columnStyles: buildColumnStyles(wideColumnWidths),
  });
  return doc.output("blob");
}
