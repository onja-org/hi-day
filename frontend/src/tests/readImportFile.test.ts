import { describe, expect, it, vi } from "vitest";
import { readImportFile } from "@/lib/readImportFile";

vi.mock("read-excel-file/browser", () => ({
  readSheet: vi.fn().mockResolvedValue([
    ["email", "role"],
    ["ada@example.com", null],
    [null, null],
    [42, true],
  ]),
}));

describe("readImportFile", () => {
  it("parses a .csv file's text", async () => {
    const file = new File(["email\na@x.com"], "members.csv", { type: "text/csv" });
    expect(await readImportFile(file)).toEqual([["email"], ["a@x.com"]]);
  });

  it("reads an .xlsx file's first sheet as text cells, dropping blank rows", async () => {
    const file = new File(["binary"], "members.xlsx");
    expect(await readImportFile(file)).toEqual([
      ["email", "role"],
      ["ada@example.com", ""],
      ["42", "true"],
    ]);
  });

  it("rejects any other file type", async () => {
    const file = new File(["x"], "members.xls");
    await expect(readImportFile(file)).rejects.toThrow(".csv or .xlsx");
  });
});
