import { useQuery } from "@tanstack/react-query";
import { getOrganisationTeams } from "@/lib/getOrganisationTeams";

export const ORGANISATION_TEAMS_QUERY_KEY = (organisationId: string) => [
  "organisation",
  organisationId,
  "teams",
];

export function useOrganisationTeams(
  organisationId: string,
  options: { enabled?: boolean } = {},
) {
  return useQuery({
    queryKey: ORGANISATION_TEAMS_QUERY_KEY(organisationId),
    queryFn: async () => {
      const result = await getOrganisationTeams(organisationId);
      if (!result.ok) {
        throw new Error(result.message);
      }
      return result.teams;
    },
    enabled: options.enabled ?? true,
  });
}
