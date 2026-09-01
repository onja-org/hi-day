import { useQuery } from "@tanstack/react-query";
import { getCurrentOrganisation } from "@/lib/getCurrentOrganisation";

export const CURRENT_ORGANISATION_QUERY_KEY = ["organisation", "current"];

export function useCurrentOrganisation() {
  return useQuery({
    queryKey: CURRENT_ORGANISATION_QUERY_KEY,
    queryFn: async () => {
      const result = await getCurrentOrganisation();
      if (!result.ok) {
        throw new Error(result.message);
      }
      return result.organisation;
    },
  });
}
