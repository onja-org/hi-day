import { useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { TIME_ENTRIES_QUERY_KEY_PREFIX } from "./useTimeEntries";

/**
 * Refreshes everything a change to a Time entry can alter.
 *
 * The timesheet itself, obviously — but also the Activity views. Captured
 * app events, URL sessions and screenshots take their project label from
 * whichever entry covers them, and the backend prunes the ones a delete or a
 * moved boundary leaves uncovered. Both effects are invisible on the
 * Activity tabs until their own queries refetch, so a row can otherwise sit
 * there labelled with a project that no longer exists.
 *
 * Prefix invalidation: each key continues with the member and date being
 * viewed, and any of them may be affected.
 */
export function useInvalidateTimeEntryViews(organisationId: string): () => void {
  const queryClient = useQueryClient();

  return useCallback(() => {
    for (const queryKey of [
      TIME_ENTRIES_QUERY_KEY_PREFIX(organisationId),
      ["app-events", "day", organisationId],
      ["url-sessions", "day", organisationId],
      ["screenshots", "activity", organisationId],
    ]) {
      void queryClient.invalidateQueries({ queryKey });
    }
  }, [queryClient, organisationId]);
}
