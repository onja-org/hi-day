import { useQueryClient } from "@tanstack/react-query";
import { ACTIVE_MEMBERS_QUERY_KEY } from "@/hooks/useActiveMembers";
import { ORGANISATION_TEAMS_QUERY_KEY } from "@/hooks/useOrganisationTeams";
import { PROJECT_QUERY_KEY } from "@/hooks/useProject";

/** Refetches the projects list and this project's detail after a change
 * to its status or assignments — plus the members and teams lists, whose
 * project counts depend on those assignments. */
export function useInvalidateProject(organisationId: string, projectId: string) {
  const queryClient = useQueryClient();

  return () => {
    queryClient.invalidateQueries({ queryKey: ["projects", organisationId] });
    queryClient.invalidateQueries({
      queryKey: PROJECT_QUERY_KEY(organisationId, projectId),
    });
    queryClient.invalidateQueries({
      queryKey: ACTIVE_MEMBERS_QUERY_KEY(organisationId),
    });
    queryClient.invalidateQueries({
      queryKey: ORGANISATION_TEAMS_QUERY_KEY(organisationId),
    });
  };
}
