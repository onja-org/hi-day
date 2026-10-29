import { describe, expect, it } from "vitest";
import { reportTableToPdf } from "@/lib/reportTableToPdf";

describe("reportTableToPdf", () => {
  it("renders the table as a PDF", async () => {
    const blob = reportTableToPdf(
      [
        { key: "member", header: "Member" },
        { key: "total", header: "Total" },
      ],
      [{ id: "a", sortKey: "", cells: { member: "Ada", total: "01:00:00" } }],
      "Report",
    );
    expect(blob.type).toBe("application/pdf");
    expect(new TextDecoder().decode((await blob.arrayBuffer()).slice(0, 5))).toBe("%PDF-");
  });
});
