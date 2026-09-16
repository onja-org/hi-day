import { useQuery } from "@tanstack/react-query";
import { getTimeEntries } from "@/lib/getTimeEntries";
import type { GetTimeEntriesFilter } from "@/lib/getTimeEntries";

// Matches every timesheet query for this org regardless of which member or
// date range is being viewed — react-query invalidates by key *prefix*, so
// this is what a "some time entry changed" event (starting/stopping a
// timer, editing an entry) should invalidate with.
export const TIME_ENTRIES_QUERY_KEY_PREFIX = (organisationId: string) => [
  "time-entries",
  organisationId,
];

// The membership segment defaults to "self" rather than being omitted, so
// "my own timesheet" and "membershipId=my own id" (which an admin/manager
// can also pass) share one cache entry instead of quietly duplicating it.
// from/to are serialized to ISO so two equal-but-distinct Date objects
// still produce the same (cacheable) key.
export const TIME_ENTRIES_QUERY_KEY = (
  organisationId: string,
  filter: GetTimeEntriesFilter = {},
) => [
  ...TIME_ENTRIES_QUERY_KEY_PREFIX(organisationId),
  filter.membershipId ?? "self",
  filter.from?.toISOString() ?? null,
  filter.to?.toISOString() ?? null,
];

export function useTimeEntries(
  organisationId: string,
  filter: GetTimeEntriesFilter = {},
  options: { enabled?: boolean } = {},
) {
  return useQuery({
    queryKey: TIME_ENTRIES_QUERY_KEY(organisationId, filter),
    queryFn: async () => {
      const result = await getTimeEntries(organisationId, filter);
      if (!result.ok) {
        throw new Error(result.message);
      }
      return result.entries;
    },
    enabled: options.enabled ?? true,
  });
}
