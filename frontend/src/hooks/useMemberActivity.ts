import { useQuery } from "@tanstack/react-query";
import { getMemberActivity } from "@/lib/getMemberActivity";

export const MEMBER_ACTIVITY_QUERY_KEY = (
  organisationId: string,
  membershipId: string,
) => ["activities", "member", organisationId, membershipId];

export function useMemberActivity(
  organisationId: string,
  membershipId: string,
  enabled: boolean,
) {
  return useQuery({
    queryKey: MEMBER_ACTIVITY_QUERY_KEY(organisationId, membershipId),
    queryFn: async () => {
      const result = await getMemberActivity(organisationId, membershipId);
      if (!result.ok) {
        throw new Error(result.message);
      }
      return result.entries;
    },
    enabled,
  });
}
