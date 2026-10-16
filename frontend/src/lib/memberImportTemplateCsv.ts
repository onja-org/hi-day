import { toCsvString } from "@/lib/toCsvString";

const HEADER = ["email", "role", "teams", "projects"];

/**
 * A ready-to-fill import file: the columns `parseMemberImportRows` reads,
 * plus example rows showing each role and how to list several teams/projects.
 * Uses the organisation's own team/project names when it has any, so the
 * examples pass validation if uploaded as-is; generic names otherwise.
 */
export function memberImportTemplateCsv(
  teamNames: string[],
  projectNames: string[],
  /** Off, the template has no projects column. */
  includeProjects = true,
): string {
  const [firstTeam = "Design", secondTeam = "Marketing"] = teamNames;
  const bothTeams = teamNames.length === 1 ? firstTeam : `${firstTeam}; ${secondTeam}`;
  const [firstProject = "Website", secondProject = "Mobile app"] = projectNames;
  const bothProjects =
    projectNames.length === 1 ? firstProject : `${firstProject}; ${secondProject}`;

  const rows = [
    ["jane.doe@example.com", "member", firstTeam, firstProject],
    ["john.smith@example.com", "manager", bothTeams, bothProjects],
    ["alex.lee@example.com", "member", "", ""],
  ];
  if (includeProjects) return toCsvString(HEADER, rows);
  return toCsvString(
    HEADER.slice(0, -1),
    rows.map((row) => row.slice(0, -1)),
  );
}
