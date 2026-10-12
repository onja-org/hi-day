import { useQuery } from "@tanstack/react-query";
import { getTimesheetReasons } from "@/lib/getTimesheetReasons";

export const TIMESHEET_REASONS_QUERY_KEY = (organisationId: string) => [
  "timesheet-reasons",
  organisationId,
];

/** The organisation's Reasons list, for both the Settings editor and the
 * add/edit/delete-time pickers. */
export function useTimesheetReasons(
  organisationId: string,
  options: { enabled?: boolean } = {},
) {
  return useQuery({
    queryKey: TIMESHEET_REASONS_QUERY_KEY(organisationId),
    queryFn: async () => {
      const result = await getTimesheetReasons(organisationId);
      if (!result.ok) {
        throw new Error(result.message);
      }
      return result.reasons;
    },
    enabled: (options.enabled ?? true) && organisationId !== "",
  });
}
