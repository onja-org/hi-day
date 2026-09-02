import { useQuery } from "@tanstack/react-query";
import { getActiveMembers } from "@/lib/getActiveMembers";

export const ACTIVE_MEMBERS_QUERY_KEY = (organisationId: string) => [
  "memberships",
  "active",
  organisationId,
];

export function useActiveMembers(organisationId: string) {
  return useQuery({
    queryKey: ACTIVE_MEMBERS_QUERY_KEY(organisationId),
    queryFn: async () => {
      const result = await getActiveMembers(organisationId);
      if (!result.ok) {
        throw new Error(result.message);
      }
      return result.members;
    },
  });
}
