import { useQuery } from "@tanstack/react-query";
import { getMyActivity } from "@/lib/getMyActivity";

export const MY_ACTIVITY_QUERY_KEY = (organisationId: string) => [
  "activities",
  "mine",
  organisationId,
];

export function useMyActivity(organisationId: string) {
  return useQuery({
    queryKey: MY_ACTIVITY_QUERY_KEY(organisationId),
    queryFn: async () => {
      const result = await getMyActivity(organisationId);
      if (!result.ok) {
        throw new Error(result.message);
      }
      return result.entries;
    },
  });
}
