import { useQuery } from "@tanstack/react-query";
import { getTimeEntries } from "@/lib/getTimeEntries";

// The trailing segment defaults to "self" rather than being omitted, so
// "my own timesheet" and "membershipId=my own id" (which an admin/manager
// can also pass) share one cache entry instead of quietly duplicating it.
export const TIME_ENTRIES_QUERY_KEY = (organisationId: string, membershipId?: string) => [
  "time-entries",
  organisationId,
  membershipId ?? "self",
];

export function useTimeEntries(organisationId: string, membershipId?: string) {
  return useQuery({
    queryKey: TIME_ENTRIES_QUERY_KEY(organisationId, membershipId),
    queryFn: async () => {
      const result = await getTimeEntries(organisationId, membershipId);
      if (!result.ok) {
        throw new Error(result.message);
      }
      return result.entries;
    },
  });
}
