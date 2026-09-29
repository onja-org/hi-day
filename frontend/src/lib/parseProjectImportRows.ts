import type { ProjectColour, ProjectFormInput } from "@/types/project";

export type ProjectImportRow = {
  /** 1-based line number in the file, for pointing at errors. */
  line: number;
  name: string;
  input: ProjectFormInput | null;
  error: string | null;
};

type ParseProjectImportOptions = {
  teams: { id: string; name: string }[];
  members: { id: string; email: string }[];
  /** Every project already in the organisation, archived ones included —
   * a name is unique across both. */
  existingProjectNames: string[];
};

const COLOURS: ProjectColour[] = [
  "blue",
  "green",
  "amber",
  "red",
  "purple",
  "teal",
  "pink",
  "gray",
];

// Mirror CreateProjectDto's limits so a row fails here, not mid-import.
const MAX_NAME_LENGTH = 255;
const MAX_DESCRIPTION_LENGTH = 2000;
const MAX_ASSIGNMENTS = 200;

function splitList(text: string): string[] {
  return text
    .split(";")
    .map((item) => item.trim())
    .filter(Boolean);
}

function lookup(entries: [string, string][]): Map<string, string> {
  return new Map(entries.map(([key, id]) => [key.trim().toLowerCase(), id]));
}

/**
 * Turns an import file's rows into create-project inputs. The first row is
 * a header naming the columns (any order, any case): `name` (required),
 * `description`, `colour` (one of the eight project colours, default
 * blue), `teams` (team names) and `members` (member emails), the last two
 * separated by `;`. Members join as project members. A bad row becomes an
 * error rather than being dropped, so the preview can show it.
 */
export function parseProjectImportRows(
  rows: string[][],
  { teams, members, existingProjectNames }: ParseProjectImportOptions,
): { rows: ProjectImportRow[]; headerError: string | null } {
  const [header, ...body] = rows;
  const columns = (header ?? []).map((cell) => cell.trim().toLowerCase());
  const nameColumn = columns.indexOf("name");
  if (nameColumn === -1) {
    return { rows: [], headerError: 'The first row must include a "name" column.' };
  }
  const column = (...names: string[]) =>
    columns.findIndex((candidate) => names.includes(candidate));
  const descriptionColumn = column("description");
  const colourColumn = column("colour", "color");
  const teamsColumn = column("teams", "team");
  const membersColumn = column("members", "member");

  const teamIds = lookup(teams.map((team) => [team.name, team.id]));
  const memberIds = lookup(members.map((member) => [member.email, member.id]));
  const existingNames = new Set(existingProjectNames.map((name) => name.trim().toLowerCase()));
  const cell = (row: string[], index: number) => (index === -1 ? "" : (row[index] ?? "").trim());

  const firstLineByName = new Map<string, number>();

  const parsed = body.map((row, index): ProjectImportRow => {
    const line = index + 2;
    const name = cell(row, nameColumn);
    const fail = (error: string): ProjectImportRow => ({ line, name, input: null, error });

    if (!name) return fail("Missing name.");
    if (name.length > MAX_NAME_LENGTH) {
      return fail(`Name is longer than ${MAX_NAME_LENGTH} characters.`);
    }
    const key = name.toLowerCase();
    if (existingNames.has(key)) return fail(`A project named "${name}" already exists.`);
    const firstLine = firstLineByName.get(key);
    if (firstLine !== undefined) return fail(`Duplicate of line ${firstLine}.`);
    firstLineByName.set(key, line);

    const description = cell(row, descriptionColumn);
    if (description.length > MAX_DESCRIPTION_LENGTH) {
      return fail(`Description is longer than ${MAX_DESCRIPTION_LENGTH} characters.`);
    }

    const colourText = cell(row, colourColumn).toLowerCase() || "blue";
    const colour = COLOURS.find((candidate) => candidate === colourText);
    if (!colour) return fail(`Unknown colour "${colourText}" — use ${COLOURS.join(", ")}.`);

    const teamNames = splitList(cell(row, teamsColumn));
    const unknownTeam = teamNames.find((teamName) => !teamIds.has(teamName.toLowerCase()));
    if (unknownTeam) return fail(`Unknown team "${unknownTeam}".`);

    const emails = splitList(cell(row, membersColumn));
    const unknownEmail = emails.find((email) => !memberIds.has(email.toLowerCase()));
    if (unknownEmail) return fail(`No active member with the email "${unknownEmail}".`);

    const rowTeamIds = [...new Set(teamNames.map((teamName) => teamIds.get(teamName.toLowerCase())!))];
    const rowMemberIds = [...new Set(emails.map((email) => memberIds.get(email.toLowerCase())!))];
    if (rowTeamIds.length > MAX_ASSIGNMENTS || rowMemberIds.length > MAX_ASSIGNMENTS) {
      return fail(`At most ${MAX_ASSIGNMENTS} teams and ${MAX_ASSIGNMENTS} members per project.`);
    }

    return {
      line,
      name,
      error: null,
      input: {
        name,
        colour,
        ...(description ? { description } : {}),
        ...(rowTeamIds.length ? { teamIds: rowTeamIds } : {}),
        ...(rowMemberIds.length
          ? { members: rowMemberIds.map((membershipId) => ({ membershipId, role: "member" as const })) }
          : {}),
      },
    };
  });

  return { rows: parsed, headerError: null };
}
