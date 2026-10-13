import { entrySeconds } from "@/lib/entrySeconds";
import { formatElapsed } from "@/lib/formatElapsed";
import { entryDayLabel, groupEntriesBy, memberLabelOf } from "@/lib/groupEntriesBy";
import { splitEntrySeconds } from "@/lib/splitEntrySeconds";
import type { IdleMember } from "@/types/idleMember";
import type { WeekStart } from "@/types/organisation";
import type { ReportTableRow } from "@/types/reportTable";
import type { MembershipTeamNames, TimeActivityGrouping } from "@/types/timeActivityGrouping";
import type { TimeEntryListItem } from "@/types/timeEntry";

type RowOptions = {
  /** Skip the per-day level under project/member/team groups. */
  sumDates: boolean;
  teamNames: MembershipTeamNames;
  /** Members to list under "Member" grouping even when they have no entries, as zero-hour rows. */
  idleMembers?: IdleMember[];
  /** Only read by the "week" grouping. */
  weekStart?: WeekStart;
  /** The zone days are read in; the browser's when omitted. */
  zone?: string;
};

function hours(seconds: number): string {
  return formatElapsed(seconds * 1000);
}

function distinct(values: (string | null)[]): string {
  const unique = [...new Set(values.filter((value): value is string => value !== null))];
  return unique.length > 0 ? unique.join(", ") : "-";
}

function teamsOf(entries: TimeEntryListItem[], teamNames: MembershipTeamNames): string[] {
  return [...new Set(entries.flatMap((entry) => teamNames.get(entry.membershipId) ?? []))];
}

function entryCells(entries: TimeEntryListItem[]): Record<string, string> {
  const { tracked, manual } = splitEntrySeconds(entries);
  const idle = entries
    .filter((entry) => entry.type === "idle")
    .reduce((sum, entry) => sum + entrySeconds(entry, null), 0);
  return {
    project: distinct(entries.map((entry) => entry.projectName)),
    regular: hours(tracked),
    total: hours(tracked + manual),
    idlePerHour: hours(idle),
    idlePercent: `${tracked + manual > 0 ? Math.round((idle / (tracked + manual)) * 100) : 0}%`,
  };
}

type MergedRow = {
  key: string;
  entries: TimeEntryListItem[];
  /** The one team this row is for, or null when the member has none. */
  team: string | null;
};

/**
 * Entries merged into one row per member + project + task + team (and per
 * day when the rows aren't already inside a single day) — a person who
 * starts and stops the timer six times on one project in a day is one row
 * with the summed hours, not six identical-looking ones. A member on
 * several teams gets a row for each, so that team's hours are visible on
 * its own. Under a team group, `onlyTeam` keeps just that group's team.
 */
function mergeEntries(
  entries: TimeEntryListItem[],
  perDay: boolean,
  teamNames: MembershipTeamNames,
  onlyTeam?: string,
  splitTeams = true,
  zone?: string,
): MergedRow[] {
  const merged = new Map<string, MergedRow>();
  for (const entry of entries) {
    const names = teamNames.get(entry.membershipId) ?? [];
    if (!splitTeams) {
      // One row per member and project whatever their teams; the Team cell lists them all.
      const key = [perDay ? entryDayLabel(entry, zone) : "", entry.membershipId, entry.projectId, entry.taskId ?? ""].join("|");
      const existing = merged.get(key);
      if (existing) existing.entries.push(entry);
      else merged.set(key, { key, entries: [entry], team: names.join(", ") || null });
      continue;
    }
    const teams: (string | null)[] = onlyTeam
      ? [names.length > 0 ? onlyTeam : null]
      : names.length > 0
        ? names
        : [null];
    for (const team of teams) {
      const key = [perDay ? entryDayLabel(entry, zone) : "", entry.membershipId, entry.projectId, entry.taskId ?? "", team ?? ""].join("|");
      const existing = merged.get(key);
      if (existing) existing.entries.push(entry);
      else merged.set(key, { key, entries: [entry], team });
    }
  }
  return [...merged.values()];
}

/** The merged rows under a group (or, for "None", the top-level rows themselves — only top-level rows carry `teams` for avatars; nested rows show team names as text). The first cell names who did the work — or, under a member group (whose own row already names them), the project. */
function leafRows(
  entries: TimeEntryListItem[],
  path: string,
  perDay: boolean,
  grouping: TimeActivityGrouping,
  teamNames: MembershipTeamNames,
  onlyTeam: string | undefined,
  isTopLevel: boolean,
  splitTeams: boolean,
  zone?: string,
): ReportTableRow[] {
  return mergeEntries(entries, perDay, teamNames, onlyTeam, splitTeams, zone).map(({ key, entries: merged, team }) => {
    const [first] = merged;
    return {
      id: path ? `${path}|${key}` : key,
      sortKey: Math.min(...merged.map((entry) => new Date(entry.startedAt).getTime())),
      cells: {
        date: grouping === "member" ? first.projectName : memberLabelOf(first),
        when: entryDayLabel(first, zone),
        ...entryCells(merged),
        ...(isTopLevel ? {} : { team: team ?? "-" }),
      },
      ...(isTopLevel ? { teams: team ? [team] : [] } : {}),
    };
  });
}

/**
 * The report's table rows. "Date per day"/"week" go group → rows. Project,
 * member and team go group → day → rows, or group → rows when
 * `sumDates` is on. "None" is a flat list of rows. A group's "(n)" counts
 * the merged rows beneath it, not raw timer sessions.
 */
export function buildTimeActivityRows(
  entries: TimeEntryListItem[],
  grouping: TimeActivityGrouping,
  { sumDates, teamNames, idleMembers = [], weekStart = "monday", zone }: RowOptions,
): ReportTableRow[] {
  if (grouping === "none") {
    return leafRows(entries, "", true, grouping, teamNames, undefined, true, true, zone);
  }

  const splitsByDay = grouping !== "day" && grouping !== "week" && !sumDates;
  // Rows that sit directly under a single day don't need the day in their key.
  const leavesPerDay = grouping !== "day" && !splitsByDay;
  // Under a day or a week there is one row per member and project, so a
  // member on two teams isn't shown twice with nothing but the team to tell
  // the rows apart. Other groupings still give each team its own row.
  const splitTeams = grouping !== "week" && grouping !== "day";

  const rows = groupEntriesBy(entries, grouping, teamNames, weekStart, zone).map((group) => {
    const onlyTeam = grouping === "team" ? group.label : undefined;
    const days = splitsByDay ? groupEntriesBy(group.entries, "day", teamNames, weekStart, zone) : [];
    const count = splitsByDay
      ? days.reduce((sum, day) => sum + mergeEntries(day.entries, false, teamNames, onlyTeam, splitTeams, zone).length, 0)
      : mergeEntries(group.entries, leavesPerDay, teamNames, onlyTeam, splitTeams, zone).length;
    return {
      id: group.id,
      sortKey: group.sortKey,
      cells: { date: `${group.label} (${count})`, ...entryCells(group.entries) },
      teams: teamsOf(group.entries, teamNames),
      subRows: splitsByDay
        ? days.map((day) => ({
            id: `${group.id}|${day.id}`,
            sortKey: day.sortKey,
            cells: {
              date: `${day.label} (${mergeEntries(day.entries, false, teamNames, onlyTeam, splitTeams, zone).length})`,
              ...entryCells(day.entries),
              team: teamsOf(day.entries, teamNames).join(", ") || "-",
            },
            subRows: leafRows(day.entries, `${group.id}|${day.id}`, false, grouping, teamNames, onlyTeam, false, splitTeams, zone),
          }))
        : leafRows(group.entries, group.id, leavesPerDay, grouping, teamNames, onlyTeam, false, splitTeams, zone),
    };
  });

  if (grouping !== "member") return rows;
  const listed = new Set(rows.map((row) => row.id));
  const idleRows = idleMembers
    .filter((member) => !listed.has(member.id))
    .map((member) => ({
      id: member.id,
      sortKey: member.label,
      cells: { date: `${member.label} (0)`, ...entryCells([]) },
      teams: teamNames.get(member.id) ?? [],
    }));
  return [...rows, ...idleRows];
}

/** Total seconds across `entries`, the figure behind the "Total time" tile. */
export function totalEntrySeconds(entries: TimeEntryListItem[]): number {
  return entries.reduce((sum, entry) => sum + entrySeconds(entry, null), 0);
}
