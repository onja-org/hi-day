import { beforeEach, describe, expect, it, vi } from "vitest";
import { buildReportTableAttachment, encodeCsvAttachment } from "@/lib/buildReportTableAttachment";
import { toPdfBlob } from "@/lib/toPdfBlob";
import type { ReportTableColumn, ReportTableRow } from "@/types/reportTable";

vi.mock("@/lib/toPdfBlob", () => ({
  toPdfBlob: vi.fn(() => new Blob(["pdf-bytes"])),
}));

const columns: ReportTableColumn[] = [
  { key: "name", header: "Name" },
  { key: "hours", header: "Hours" },
];
const rows: ReportTableRow[] = [{ id: "a", sortKey: 1, cells: { name: "Ada", hours: "01:00" } }];

beforeEach(() => vi.mocked(toPdfBlob).mockClear());

describe("buildReportTableAttachment", () => {
  it("base64-encodes the table as CSV", async () => {
    const encoded = await buildReportTableAttachment("csv", columns, rows, "Title");
    expect(atob(encoded)).toBe("Name,Hours\nAda,01:00");
    expect(toPdfBlob).not.toHaveBeenCalled();
  });

  it("base64-encodes the table as a PDF titled and filled from the flattened rows", async () => {
    const encoded = await buildReportTableAttachment("pdf", columns, rows, "Title");
    expect(atob(encoded)).toBe("pdf-bytes");
    expect(toPdfBlob).toHaveBeenCalledWith("Title", ["Name", "Hours"], [["Ada", "01:00"]]);
  });

  it("base64-encodes given CSV text as is", () => {
    expect(atob(encodeCsvAttachment("a,b\n1,2"))).toBe("a,b\n1,2");
  });
});
