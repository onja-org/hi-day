import { useQuery } from "@tanstack/react-query";
import { getMemberTimeEntries } from "@/lib/getMemberTimeEntries";

export const MEMBER_TIME_ENTRIES_QUERY_KEY = (
  organisationId: string,
  membershipId: string,
) => ["time-entries", "member", organisationId, membershipId];

export function useMemberTimeEntries(
  organisationId: string,
  membershipId: string,
  enabled: boolean,
) {
  return useQuery({
    queryKey: MEMBER_TIME_ENTRIES_QUERY_KEY(organisationId, membershipId),
    queryFn: async () => {
      const result = await getMemberTimeEntries(organisationId, membershipId);
      if (!result.ok) {
        throw new Error(result.message);
      }
      return result.entries;
    },
    enabled,
  });
}
