import { useQuery } from "@tanstack/react-query";
import { getOrganisationDeletionStatus } from "@/lib/getOrganisationDeletionStatus";

export const ORGANISATION_DELETION_STATUS_QUERY_KEY = (
  organisationId: number,
) => ["organisation", organisationId, "deletion-status"];

export function useOrganisationDeletionStatus(
  organisationId: number,
  enabled: boolean,
) {
  return useQuery({
    queryKey: ORGANISATION_DELETION_STATUS_QUERY_KEY(organisationId),
    enabled,
    queryFn: async () => {
      const result = await getOrganisationDeletionStatus(organisationId);
      if (!result.ok) {
        throw new Error(result.message);
      }
      return result.status;
    },
  });
}
