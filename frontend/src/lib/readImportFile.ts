import { getImportFileKind } from "@/lib/getImportFileKind";
import { parseCsv } from "@/lib/parseCsv";

/** Reads a member-import file into rows of text cells: CSV via `parseCsv`,
 * `.xlsx` via the first sheet (Excel number/date/boolean cells become
 * their text form). The Excel reader is loaded only when needed. */
export async function readImportFile(file: File): Promise<string[][]> {
  const kind = getImportFileKind(file.name);

  if (kind === "csv") {
    return parseCsv(await file.text());
  }

  if (kind === "xlsx") {
    const { readSheet } = await import("read-excel-file/browser");
    const rows = await readSheet(file);
    return rows
      .map((row) => row.map((cell) => (cell === null ? "" : String(cell))))
      .filter((row) => row.some((cell) => cell.trim() !== ""));
  }

  throw new Error("Choose a .csv or .xlsx file.");
}
