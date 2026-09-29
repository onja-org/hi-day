import { describe, expect, it } from "vitest";
import { parseMemberImportRows } from "@/lib/parseMemberImportRows";

const options = {
  teams: [{ id: "t-design", name: "Design" }],
  projects: [
    { id: "p-web", name: "Website" },
    { id: "p-app", name: "Mobile app" },
  ],
  canInviteAdmins: true,
};

describe("parseMemberImportRows", () => {
  it("maps columns in any order and case into invite entries", () => {
    const result = parseMemberImportRows(
      [
        ["Projects", "EMAIL", "Role", "Team"],
        ["website; mobile APP", " Ada@Example.com ", "Manager", "design"],
      ],
      options,
    );

    expect(result.headerError).toBeNull();
    expect(result.rows).toEqual([
      {
        line: 2,
        email: "ada@example.com",
        error: null,
        entry: {
          email: "ada@example.com",
          role: "manager",
          teamId: "t-design",
          projectIds: ["p-web", "p-app"],
        },
      },
    ]);
  });

  it("defaults the role to member and leaves out an empty team/projects", () => {
    const result = parseMemberImportRows([["email"], ["grace@example.com"]], options);
    expect(result.rows[0].entry).toEqual({ email: "grace@example.com", role: "member" });
  });

  it("requires an email column in the header", () => {
    const result = parseMemberImportRows([["name"], ["Ada"]], options);
    expect(result.headerError).toMatch(/email/);
    expect(result.rows).toEqual([]);
  });

  it("flags rows with a missing email, unknown role, team or project", () => {
    const result = parseMemberImportRows(
      [
        ["email", "role", "team", "projects"],
        ["", "member", "", ""],
        ["a@x.com", "finance", "", ""],
        ["b@x.com", "member", "Sales", ""],
        ["c@x.com", "member", "", "Website;Intranet"],
      ],
      options,
    );

    expect(result.rows.map((row) => [row.line, row.entry, row.error])).toEqual([
      [2, null, "Missing email."],
      [3, null, 'Unknown role "finance" — use admin, manager or member.'],
      [4, null, 'Unknown team "Sales".'],
      [5, null, 'Unknown project "Intranet".'],
    ]);
  });

  it("rejects admin rows when the importer can't invite admins", () => {
    const result = parseMemberImportRows([["email", "role"], ["a@x.com", "admin"]], {
      ...options,
      canInviteAdmins: false,
    });
    expect(result.rows[0].error).toBe("Only an admin can invite admins.");
  });

  it("flags a repeated email as a duplicate of its first line", () => {
    const result = parseMemberImportRows(
      [["email"], ["a@x.com"], ["A@X.com"]],
      options,
    );
    expect(result.rows[1].error).toBe("Duplicate of line 2.");
  });
});
