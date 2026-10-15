import { useMemo } from "react";
import { useActiveMembers } from "@/hooks/useActiveMembers";
import { useAllMembersTimeEntries } from "@/hooks/useAllMembersTimeEntries";
import { useCanViewOthers } from "@/hooks/useCanViewOthers";
import { useOrganisationTeams } from "@/hooks/useOrganisationTeams";
import { useMyProjects } from "@/hooks/useMyProjects";
import { useTimeEntries } from "@/hooks/useTimeEntries";
import { useProjectsEnabled } from "@/hooks/useProjectsEnabled";
import { buildMembershipTeamIds, buildMembershipTeamNames } from "@/lib/buildMembershipTeamNames";
import { filterReportEntries, filterReportMembers } from "@/lib/reportFilters";
import type { ReportFilters } from "@/lib/reportFilters";
import { projectFilterOptions } from "@/lib/timesheetFilters";
import type { DateRange } from "@/types/dateRange";
import type { ReportScope } from "@/types/reportScope";

/**
 * The Time and activity report's entries for a scope, plus which teams each
 * member is on. Only admins/managers get the "all" scope (and the member
 * list behind it); everyone else only ever has their own entries, but can
 * still be on several teams. The membership list the backend returns is
 * already limited to who the viewer's role may see, so "all" can't
 * over-reach.
 *
 * Also applies the filters to those entries and works out what the filter
 * drawer and table need from them.
 */
export function useTimeActivityReportData(
  organisationId: string,
  scope: ReportScope,
  range: DateRange,
  filters: ReportFilters,
  /** False while the zone the range is cut in is still settling, so entries aren't fetched twice. */
  enabled = true,
) {
  const canViewOthers = useCanViewOthers();
  const membersQuery = useActiveMembers(organisationId, { enabled: canViewOthers });
  // Open to every role: it only returns the teams the caller can see.
  const teamsQuery = useOrganisationTeams(organisationId);
  const isAll = canViewOthers && scope === "all";

  const ownQuery = useTimeEntries(organisationId, { from: range.from, to: range.to }, { enabled: enabled && !isAll });
  const allQuery = useAllMembersTimeEntries(
    organisationId,
    (membersQuery.data ?? []).map((member) => member.id),
    range,
    enabled && isAll && !membersQuery.isLoading,
  );

  const teamIdsByMember = useMemo(() => buildMembershipTeamIds(teamsQuery.data ?? []), [teamsQuery.data]);

  // A member filter only means something when other people's data is shown;
  // a leftover choice from the "All" tab must not silently apply to "Me".
  // Teams apply to both: even your own entries can sit under several teams.
  // Likewise a project filter saved while Projects were on: with them off it
  // can't be seen or cleared, and entries have no project to match.
  const projectsEnabled = useProjectsEnabled();
  const activeFilters: ReportFilters = {
    ...(isAll ? filters : { ...filters, memberIds: [] }),
    ...(projectsEnabled ? {} : { projectIds: [] }),
  };
  // With a team filter on, only those teams are shown or grouped by: a member
  // on both "General" and another team would otherwise still list the other
  // one beside the team that was asked for.
  const teamNames = useMemo(
    () =>
      buildMembershipTeamNames(
        activeFilters.teamIds.length > 0
          ? (teamsQuery.data ?? []).filter((team) => activeFilters.teamIds.includes(team.id))
          : (teamsQuery.data ?? []),
      ),
    [teamsQuery.data, activeFilters.teamIds],
  );

  const allEntries = isAll ? (membersQuery.isLoading ? undefined : allQuery.data) : ownQuery.data;
  const myProjectsQuery = useMyProjects(organisationId);

  return {
    canViewOthers,
    showsEveryone: isAll,
    activeFilters,
    teamNames,
    members: membersQuery.data,
    teams: teamsQuery.data,
    // Everyone the filters leave in, so a member with no time shows as zero.
    // Not when a project filter is on: "no time" is then ambiguous.
    idleMembers:
      isAll && activeFilters.projectIds.length === 0
        ? filterReportMembers(membersQuery.data ?? [], activeFilters, teamIdsByMember).map((member) => ({
            id: member.id,
            label: member.name ?? member.email,
          }))
        : [],
    entries: allEntries ? filterReportEntries(allEntries, activeFilters, teamIdsByMember) : undefined,
    // From the unfiltered entries, so narrowing to one project doesn't make
    // the others vanish from the picker.
    projectOptions: projectFilterOptions(myProjectsQuery.data ?? [], allEntries ?? []),
    isLoading: isAll ? membersQuery.isLoading || allQuery.isLoading : ownQuery.isLoading,
    error: isAll ? (membersQuery.error ?? allQuery.error) : ownQuery.error,
  };
}
