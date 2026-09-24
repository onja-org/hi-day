import { useQuery } from "@tanstack/react-query";
import { getUrlSessions } from "@/lib/getUrlSessions";

// Matched to the desktop agent's own upload cadence (SYNC_INTERVAL_MS in
// desktop/src/main/main.ts) — polling faster than new data can possibly
// arrive just adds requests without adding freshness. Without this the
// page only refetched on mount or window-focus, so it sat visibly stale
// while a timer ran and only caught up when you navigated away and back.
/**
 * Production cadence. Shortened in development so a URL reaches the page in
 * seconds while testing — the desktop side is already the slow link, and
 * waiting 30s on top of it makes each check needlessly long.
 */
const URL_SESSIONS_POLL_INTERVAL_MS =
  process.env.NODE_ENV === "development" ? 5_000 : 30_000;

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
    refetchInterval: URL_SESSIONS_POLL_INTERVAL_MS,
  });
}
