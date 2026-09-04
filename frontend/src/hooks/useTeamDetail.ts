import { useQuery } from "@tanstack/react-query";
import { getTeamDetail } from "@/lib/getTeamDetail";

export const TEAM_DETAIL_QUERY_KEY = (
  organisationId: string,
  teamId: string,
) => ["organisation", organisationId, "teams", teamId];

export function useTeamDetail(organisationId: string, teamId: string) {
  return useQuery({
    queryKey: TEAM_DETAIL_QUERY_KEY(organisationId, teamId),
    queryFn: async () => {
      const result = await getTeamDetail(organisationId, teamId);
      if (!result.ok) {
        throw new Error(result.message);
      }
      return result.team;
    },
  });
}
