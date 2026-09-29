export type ImportFileKind = "csv" | "xlsx" | "unsupported";

/** Which parser an import file needs, by extension. Legacy `.xls`
 * isn't supported — the Excel reader only handles the `.xlsx` format. */
export function getImportFileKind(filename: string): ImportFileKind {
  const extension = filename.toLowerCase().split(".").pop();
  if (extension === "csv") return "csv";
  if (extension === "xlsx") return "xlsx";
  return "unsupported";
}
