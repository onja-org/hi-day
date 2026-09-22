import { useQuery } from "@tanstack/react-query";
import { getAssignableProjectTeams } from "@/lib/getAssignableProjectTeams";

export const ASSIGNABLE_PROJECT_TEAMS_QUERY_KEY = (
  organisationId: string,
  projectId?: string,
) => ["projects", organisationId, projectId ?? "new", "assignable-teams"];

export function useAssignableProjectTeams(
  organisationId: string,
  projectId?: string,
) {
  return useQuery({
    queryKey: ASSIGNABLE_PROJECT_TEAMS_QUERY_KEY(organisationId, projectId),
    queryFn: async () => {
      const result = await getAssignableProjectTeams(organisationId, projectId);
      if (!result.ok) {
        throw new Error(result.message);
      }
      return result.teams;
    },
  });
}
