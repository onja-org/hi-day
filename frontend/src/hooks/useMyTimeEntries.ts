import { useQuery } from "@tanstack/react-query";
import { getMyTimeEntries } from "@/lib/getMyTimeEntries";

export const MY_TIME_ENTRIES_QUERY_KEY = (organisationId: string) => [
  "time-entries",
  "mine",
  organisationId,
];

export function useMyTimeEntries(organisationId: string) {
  return useQuery({
    queryKey: MY_TIME_ENTRIES_QUERY_KEY(organisationId),
    queryFn: async () => {
      const result = await getMyTimeEntries(organisationId);
      if (!result.ok) {
        throw new Error(result.message);
      }
      return result.entries;
    },
  });
}
