import { useMemo } from "react";
import { useActiveMembers } from "@/hooks/useActiveMembers";
import { useAllMembersTimeEntries } from "@/hooks/useAllMembersTimeEntries";
import { useCanViewOthers } from "@/hooks/useCanViewOthers";
import { useOrganisationTeams } from "@/hooks/useOrganisationTeams";
import { useTimeEntries } from "@/hooks/useTimeEntries";
import { buildMembershipTeamNames } from "@/lib/buildMembershipTeamNames";
import type { DateRange } from "@/types/dateRange";
import type { ReportScope } from "@/types/reportScope";

/**
 * The Time and activity report's entries for a scope, plus which teams each
 * member is on. Only admins/managers get the "all" scope (and the member and
 * team lists behind it); everyone else only ever has their own entries. The
 * membership list the backend returns is already limited to who the
 * viewer's role may see, so "all" can't over-reach.
 */
export function useTimeActivityReportData(
  organisationId: string,
  scope: ReportScope,
  range: DateRange,
) {
  const canViewOthers = useCanViewOthers();
  const membersQuery = useActiveMembers(organisationId, { enabled: canViewOthers });
  const teamsQuery = useOrganisationTeams(organisationId, { enabled: canViewOthers });
  const isAll = canViewOthers && scope === "all";

  const ownQuery = useTimeEntries(organisationId, { from: range.from, to: range.to }, { enabled: !isAll });
  const allQuery = useAllMembersTimeEntries(
    organisationId,
    (membersQuery.data ?? []).map((member) => member.id),
    range,
    isAll && !membersQuery.isLoading,
  );

  const teamNames = useMemo(
    () => buildMembershipTeamNames(membersQuery.data ?? [], teamsQuery.data ?? []),
    [membersQuery.data, teamsQuery.data],
  );

  return {
    canViewOthers,
    teamNames,
    entries: isAll ? (membersQuery.isLoading ? undefined : allQuery.data) : ownQuery.data,
    isLoading: isAll ? membersQuery.isLoading || allQuery.isLoading : ownQuery.isLoading,
    error: isAll ? (membersQuery.error ?? allQuery.error) : ownQuery.error,
  };
}
