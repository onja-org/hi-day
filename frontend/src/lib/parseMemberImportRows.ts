import type { InviteEntryInput } from "@/types/invitation";
import type { MembershipRole } from "@/types/membership";

export type MemberImportRow = {
  /** 1-based line number in the file, for pointing at errors. */
  line: number;
  email: string;
  entry: InviteEntryInput | null;
  error: string | null;
};

type NamedItem = { id: string; name: string };

type ParseMemberImportOptions = {
  teams: NamedItem[];
  projects: NamedItem[];
  /** Only an admin may invite admins — see InvitationsService.createMany. */
  canInviteAdmins: boolean;
};

const INVITABLE_ROLES: MembershipRole[] = ["admin", "manager", "member"];

function lookupByName(items: NamedItem[]): Map<string, string> {
  return new Map(items.map((item) => [item.name.trim().toLowerCase(), item.id]));
}

/**
 * Turns an import file's rows into invite entries. The first row is a
 * header naming the columns (any order, any case): `email` (required),
 * `role` (admin/manager/member, default member), `team` (one team name),
 * `projects` (project names separated by `;`). Unknown names or roles make
 * that row an error rather than being dropped, so the preview can show it.
 */
export function parseMemberImportRows(
  rows: string[][],
  { teams, projects, canInviteAdmins }: ParseMemberImportOptions,
): { rows: MemberImportRow[]; headerError: string | null } {
  const [header, ...body] = rows;
  const columns = (header ?? []).map((cell) => cell.trim().toLowerCase());
  const emailColumn = columns.indexOf("email");
  if (emailColumn === -1) {
    return { rows: [], headerError: 'The first row must include an "email" column.' };
  }
  const roleColumn = columns.indexOf("role");
  const teamColumn = columns.indexOf("team");
  const projectsColumn = columns.indexOf("projects");

  const teamIds = lookupByName(teams);
  const projectIds = lookupByName(projects);
  const cell = (row: string[], column: number) => (column === -1 ? "" : (row[column] ?? "").trim());

  const firstLineByEmail = new Map<string, number>();

  const parsed = body.map((row, index): MemberImportRow => {
    const line = index + 2;
    const email = cell(row, emailColumn).toLowerCase();
    const fail = (error: string): MemberImportRow => ({ line, email, entry: null, error });

    if (!email) return fail("Missing email.");
    const firstLine = firstLineByEmail.get(email);
    if (firstLine !== undefined) return fail(`Duplicate of line ${firstLine}.`);
    firstLineByEmail.set(email, line);

    const roleText = cell(row, roleColumn).toLowerCase() || "member";
    const role = INVITABLE_ROLES.find((candidate) => candidate === roleText);
    if (!role) return fail(`Unknown role "${roleText}" — use admin, manager or member.`);
    if (role === "admin" && !canInviteAdmins) return fail("Only an admin can invite admins.");

    const teamName = cell(row, teamColumn);
    const teamId = teamName ? teamIds.get(teamName.toLowerCase()) : undefined;
    if (teamName && !teamId) return fail(`Unknown team "${teamName}".`);

    const projectNames = cell(row, projectsColumn)
      .split(";")
      .map((name) => name.trim())
      .filter(Boolean);
    const unknownProject = projectNames.find((name) => !projectIds.has(name.toLowerCase()));
    if (unknownProject) return fail(`Unknown project "${unknownProject}".`);

    return {
      line,
      email,
      error: null,
      entry: {
        email,
        role,
        ...(teamId ? { teamId } : {}),
        ...(projectNames.length
          ? { projectIds: [...new Set(projectNames.map((name) => projectIds.get(name.toLowerCase())!))] }
          : {}),
      },
    };
  });

  return { rows: parsed, headerError: null };
}
