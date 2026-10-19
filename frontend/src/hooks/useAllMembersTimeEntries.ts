import { useQueries } from "@tanstack/react-query";
import { TIME_ENTRIES_QUERY_KEY } from "@/hooks/useTimeEntries";
import { useProjectsEnabled } from "@/hooks/useProjectsEnabled";
import { getTimeEntries } from "@/lib/getTimeEntries";
import { hideEntryProjects } from "@/lib/hideEntryProjects";
import type { TimeEntryListItem } from "@/types/timeEntry";

/**
 * Every given member's entries for a range, merged. The time-entries API
 * only returns one member at a time, so this fans out one request per
 * member — sharing `useTimeEntries`' cache keys, so a member already viewed
 * on its own isn't fetched twice. `data` stays undefined until every
 * member's request has succeeded, so a half-loaded report never shows.
 */
export function useAllMembersTimeEntries(
  organisationId: string,
  membershipIds: string[],
  range: { from: Date; to: Date },
  enabled: boolean,
) {
  const projectsEnabled = useProjectsEnabled();

  return useQueries({
    queries: membershipIds.map((membershipId) => ({
      queryKey: TIME_ENTRIES_QUERY_KEY(organisationId, { membershipId, ...range }),
      queryFn: async () => {
        const result = await getTimeEntries(organisationId, { membershipId, ...range });
        if (!result.ok) throw new Error(result.message);
        return result.entries;
      },
      enabled,
      select: (entries: TimeEntryListItem[]) =>
        projectsEnabled ? entries : hideEntryProjects(entries),
    })),
    combine: (results) => ({
      data: results.every((result) => result.data)
        ? results.flatMap((result): TimeEntryListItem[] => result.data ?? [])
        : undefined,
      isLoading: results.some((result) => result.isLoading),
      error: results.find((result) => result.error)?.error ?? null,
    }),
  });
}
