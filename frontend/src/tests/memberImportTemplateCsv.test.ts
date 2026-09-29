import { describe, expect, it } from "vitest";
import { memberImportTemplateCsv } from "@/lib/memberImportTemplateCsv";
import { parseCsv } from "@/lib/parseCsv";
import { parseMemberImportRows } from "@/lib/parseMemberImportRows";

describe("memberImportTemplateCsv", () => {
  it("uses the organisation's own team and project names in the examples", () => {
    const rows = parseCsv(memberImportTemplateCsv(["Sales"], ["Intranet", "Portal"]));
    expect(rows).toEqual([
      ["email", "role", "teams", "projects"],
      ["jane.doe@example.com", "member", "Sales", "Intranet"],
      ["john.smith@example.com", "manager", "Sales", "Intranet; Portal"],
      ["alex.lee@example.com", "member", "", ""],
    ]);
  });

  it("falls back to generic names when there are no teams or projects", () => {
    const rows = parseCsv(memberImportTemplateCsv([], []));
    expect(rows[1]).toEqual(["jane.doe@example.com", "member", "Design", "Website"]);
    expect(rows[2][2]).toBe("Design; Marketing");
    expect(rows[2][3]).toBe("Website; Mobile app");
  });

  it("doesn't repeat a project when the organisation only has one", () => {
    const rows = parseCsv(memberImportTemplateCsv(["Sales"], ["Intranet"]));
    expect(rows[2][3]).toBe("Intranet");
  });

  it("produces a file the importer accepts without errors", () => {
    const teams = [{ id: "t-1", name: "Sales" }];
    const projects = [
      { id: "p-1", name: "Intranet" },
      { id: "p-2", name: "Portal" },
    ];
    const csv = memberImportTemplateCsv(["Sales"], ["Intranet", "Portal"]);
    const result = parseMemberImportRows(parseCsv(csv), { teams, projects, canInviteAdmins: false });
    expect(result.headerError).toBeNull();
    expect(result.rows.every((row) => row.error === null)).toBe(true);
  });
});
