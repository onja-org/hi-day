import { useQueryClient } from "@tanstack/react-query";
import { ACTIVE_MEMBERS_QUERY_KEY } from "@/hooks/useActiveMembers";
import { ORGANISATION_TEAMS_QUERY_KEY } from "@/hooks/useOrganisationTeams";

/** Refetches every team query (the list is a prefix of each team's detail
 * key) and the members list, whose Teams column reflects rosters — after
 * any change to a team's name or members. */
export function useInvalidateTeams(organisationId: string) {
  const queryClient = useQueryClient();

  return () => {
    queryClient.invalidateQueries({
      queryKey: ORGANISATION_TEAMS_QUERY_KEY(organisationId),
    });
    queryClient.invalidateQueries({
      queryKey: ACTIVE_MEMBERS_QUERY_KEY(organisationId),
    });
  };
}
