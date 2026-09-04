import { useQuery } from "@tanstack/react-query";
import { getCurrentTimeEntry } from "@/lib/getCurrentTimeEntry";

// Matches the desktop agent's own poll interval (see
// desktop/src/renderer/renderer.ts) so a timer started on one surface
// shows up on the other within the same window.
const CURRENT_TIME_ENTRY_POLL_INTERVAL_MS = 15_000;

export const CURRENT_TIME_ENTRY_QUERY_KEY = (organisationId: string) => [
  "time-entries",
  organisationId,
  "current",
];

export function useCurrentTimeEntry(organisationId: string) {
  return useQuery({
    queryKey: CURRENT_TIME_ENTRY_QUERY_KEY(organisationId),
    queryFn: async () => {
      const result = await getCurrentTimeEntry(organisationId);
      if (!result.ok) {
        throw new Error(result.message);
      }
      return result.data;
    },
    refetchInterval: CURRENT_TIME_ENTRY_POLL_INTERVAL_MS,
  });
}
