import { toCsvString } from "@/lib/toCsvString";

const HEADER = ["name", "description", "colour", "teams", "members"];

/**
 * A ready-to-fill import file: the columns `parseProjectImportRows` reads,
 * plus example rows showing a colour and how to list several teams/members.
 * Uses the organisation's own team names and member emails when it has
 * any, so those columns pass validation as-is; generic ones otherwise.
 */
export function projectImportTemplateCsv(teamNames: string[], memberEmails: string[]): string {
  const [firstTeam = "Design", secondTeam = "Marketing"] = teamNames;
  const bothTeams = teamNames.length === 1 ? firstTeam : `${firstTeam}; ${secondTeam}`;
  const [firstMember = "jane.doe@example.com", secondMember = "john.smith@example.com"] =
    memberEmails;
  const bothMembers =
    memberEmails.length === 1 ? firstMember : `${firstMember}; ${secondMember}`;

  return toCsvString(HEADER, [
    ["Website redesign", "New marketing site", "blue", firstTeam, firstMember],
    ["Mobile app", "", "green", bothTeams, bothMembers],
    ["Internal tools", "", "", "", ""],
  ]);
}
