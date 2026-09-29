import { useQueryClient } from "@tanstack/react-query";
import { ACTIVE_MEMBERS_QUERY_KEY } from "@/hooks/useActiveMembers";
import { ORGANISATION_TEAMS_QUERY_KEY } from "@/hooks/useOrganisationTeams";

/** Refetches every list that shows who's on which team or project — the
 * members list, every team query, and every project query (the projects
 * list key is a prefix of each project's detail key). */
export function useInvalidateAssignments(organisationId: string) {
  const queryClient = useQueryClient();

  return () => {
    queryClient.invalidateQueries({ queryKey: ["projects", organisationId] });
    queryClient.invalidateQueries({ queryKey: ORGANISATION_TEAMS_QUERY_KEY(organisationId) });
    queryClient.invalidateQueries({ queryKey: ACTIVE_MEMBERS_QUERY_KEY(organisationId) });
  };
}
