import { describe, expect, it } from "vitest";
import { getImportFileKind } from "@/lib/getImportFileKind";

describe("getImportFileKind", () => {
  it("recognises CSV and XLSX regardless of case", () => {
    expect(getImportFileKind("members.csv")).toBe("csv");
    expect(getImportFileKind("Members.XLSX")).toBe("xlsx");
  });

  it("rejects legacy .xls and anything else", () => {
    expect(getImportFileKind("members.xls")).toBe("unsupported");
    expect(getImportFileKind("members.txt")).toBe("unsupported");
    expect(getImportFileKind("members")).toBe("unsupported");
  });
});
