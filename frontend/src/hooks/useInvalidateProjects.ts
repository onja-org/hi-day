import { useQueryClient } from "@tanstack/react-query";
import { ACTIVE_MEMBERS_QUERY_KEY } from "@/hooks/useActiveMembers";
import { ORGANISATION_TEAMS_QUERY_KEY } from "@/hooks/useOrganisationTeams";

/** Refetches every project query in the organisation after a change that
 * touches several projects at once (batch actions, import, delete) — plus
 * the members and teams lists, whose project counts depend on them. */
export function useInvalidateProjects(organisationId: string) {
  const queryClient = useQueryClient();

  return () => {
    queryClient.invalidateQueries({ queryKey: ["projects", organisationId] });
    queryClient.invalidateQueries({
      queryKey: ACTIVE_MEMBERS_QUERY_KEY(organisationId),
    });
    queryClient.invalidateQueries({
      queryKey: ORGANISATION_TEAMS_QUERY_KEY(organisationId),
    });
  };
}
