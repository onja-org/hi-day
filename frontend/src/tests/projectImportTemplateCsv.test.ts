import { describe, expect, it } from "vitest";
import { parseCsv } from "@/lib/parseCsv";
import { parseProjectImportRows } from "@/lib/parseProjectImportRows";
import { projectImportTemplateCsv } from "@/lib/projectImportTemplateCsv";

describe("projectImportTemplateCsv", () => {
  it("uses the organisation's own team names and member emails in the examples", () => {
    const rows = parseCsv(projectImportTemplateCsv(["Sales"], ["ada@acme.com", "bob@acme.com"]));
    expect(rows).toEqual([
      ["name", "description", "colour", "teams", "members"],
      ["Website redesign", "New marketing site", "blue", "Sales", "ada@acme.com"],
      ["Mobile app", "", "green", "Sales", "ada@acme.com; bob@acme.com"],
      ["Internal tools", "", "", "", ""],
    ]);
  });

  it("falls back to generic names when there are no teams or members", () => {
    const rows = parseCsv(projectImportTemplateCsv([], []));
    expect(rows[2][3]).toBe("Design; Marketing");
    expect(rows[2][4]).toBe("jane.doe@example.com; john.smith@example.com");
  });

  it("produces a file the importer accepts without errors", () => {
    const csv = projectImportTemplateCsv(["Sales"], ["ada@acme.com"]);
    const result = parseProjectImportRows(parseCsv(csv), {
      teams: [{ id: "t-1", name: "Sales" }],
      members: [{ id: "m-1", email: "ada@acme.com" }],
      existingProjectNames: [],
    });
    expect(result.headerError).toBeNull();
    expect(result.rows.every((row) => row.error === null)).toBe(true);
  });
});
