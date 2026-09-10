import { useQuery } from "@tanstack/react-query";
import { getUrlSessions } from "@/lib/getUrlSessions";

// The membership segment defaults to "self" rather than being omitted, so
// "my own tracked URLs" and "membershipId=my own id" (which an admin/
// manager can also pass) share one cache entry instead of quietly
// duplicating it — same reasoning as TIME_ENTRIES_QUERY_KEY.
export const URL_SESSIONS_QUERY_KEY = (
  organisationId: string,
  membershipId?: string,
) => ["url-sessions", organisationId, membershipId ?? "self"];

export function useUrlSessions(organisationId: string, membershipId?: string) {
  return useQuery({
    queryKey: URL_SESSIONS_QUERY_KEY(organisationId, membershipId),
    queryFn: async () => {
      const result = await getUrlSessions(organisationId, membershipId);
      if (!result.ok) {
        throw new Error(result.message);
      }
      return result.groups;
    },
  });
}
