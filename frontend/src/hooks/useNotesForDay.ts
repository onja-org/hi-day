import { useQuery } from "@tanstack/react-query";
import { getNotesForDay } from "@/lib/getNotesForDay";
import type { GetNotesForDayFilter } from "@/lib/getNotesForDay";

export const NOTES_FOR_DAY_QUERY_KEY = (
  organisationId: string,
  filter: GetNotesForDayFilter = {},
) => [
  "notes",
  organisationId,
  filter.membershipId ?? "self",
  filter.date ?? null,
  filter.projectId ?? null,
];

export function useNotesForDay(
  organisationId: string,
  filter: GetNotesForDayFilter = {},
) {
  return useQuery({
    queryKey: NOTES_FOR_DAY_QUERY_KEY(organisationId, filter),
    queryFn: async () => {
      const result = await getNotesForDay(organisationId, filter);
      if (!result.ok) {
        throw new Error(result.message);
      }
      return result.notes;
    },
  });
}
