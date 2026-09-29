import { describe, expect, it } from "vitest";
import { parseProjectImportRows } from "@/lib/parseProjectImportRows";

const options = {
  teams: [
    { id: "t-design", name: "Design" },
    { id: "t-sales", name: "Sales" },
  ],
  members: [
    { id: "m-ada", email: "ada@example.com" },
    { id: "m-bob", email: "bob@example.com" },
  ],
  existingProjectNames: ["Intranet"],
};

function errors(rows: string[][]) {
  return parseProjectImportRows([["name", "colour", "teams", "members"], ...rows], options).rows.map(
    (row) => row.error,
  );
}

describe("parseProjectImportRows", () => {
  it("maps columns in any order and case into create-project inputs", () => {
    const result = parseProjectImportRows(
      [
        ["Members", "Colour", "NAME", "Team", "Description"],
        ["ADA@example.com; bob@example.com", "Green", " Website ", "design; SALES", " Marketing site "],
      ],
      options,
    );

    expect(result.headerError).toBeNull();
    expect(result.rows).toEqual([
      {
        line: 2,
        name: "Website",
        error: null,
        input: {
          name: "Website",
          colour: "green",
          description: "Marketing site",
          teamIds: ["t-design", "t-sales"],
          members: [
            { membershipId: "m-ada", role: "member" },
            { membershipId: "m-bob", role: "member" },
          ],
        },
      },
    ]);
  });

  it("defaults the colour to blue and leaves out empty optional fields", () => {
    const result = parseProjectImportRows([["name"], ["Website"]], options);
    expect(result.rows[0].input).toEqual({ name: "Website", colour: "blue" });
  });

  it("accepts the American spelling of the colour column", () => {
    const result = parseProjectImportRows([["name", "color"], ["Website", "teal"]], options);
    expect(result.rows[0].input?.colour).toBe("teal");
  });

  it("requires a name column", () => {
    const result = parseProjectImportRows([["title"], ["Website"]], options);
    expect(result).toEqual({
      rows: [],
      headerError: 'The first row must include a "name" column.',
    });
  });

  it("flags a missing name, a clash with an existing project, and a repeat within the file", () => {
    expect(errors([[""], ["intranet"], ["Website"], ["WEBSITE"]])).toEqual([
      "Missing name.",
      'A project named "intranet" already exists.',
      null,
      "Duplicate of line 4.",
    ]);
  });

  it("flags an unknown colour, team or member email", () => {
    expect(
      errors([
        ["A", "orange"],
        ["B", "", "Finance"],
        ["C", "", "", "nobody@example.com"],
      ]),
    ).toEqual([
      'Unknown colour "orange" — use blue, green, amber, red, purple, teal, pink, gray.',
      'Unknown team "Finance".',
      'No active member with the email "nobody@example.com".',
    ]);
  });

  it("flags a name or description over the backend's length limits", () => {
    const result = parseProjectImportRows(
      [
        ["name", "description"],
        ["x".repeat(256), ""],
        ["Website", "y".repeat(2001)],
      ],
      options,
    );
    expect(result.rows.map((row) => row.error)).toEqual([
      "Name is longer than 255 characters.",
      "Description is longer than 2000 characters.",
    ]);
  });

  it("lists a team or member only once when repeated in a row", () => {
    const result = parseProjectImportRows(
      [["name", "teams", "members"], ["Website", "Design; design", "ada@example.com; ADA@example.com"]],
      options,
    );
    expect(result.rows[0].input?.teamIds).toEqual(["t-design"]);
    expect(result.rows[0].input?.members).toEqual([{ membershipId: "m-ada", role: "member" }]);
  });
});
