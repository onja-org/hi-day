import { useMutation } from "@tanstack/react-query";
import { deleteTimeEntry } from "@/lib/deleteTimeEntry";
import { useInvalidateTimeEntryViews } from "./useInvalidateTimeEntryViews";

/** Deletes one Time entry and refreshes every view it touched. */
export function useDeleteTimeEntry(
  organisationId: string,
  timeEntryId: string,
  onDeleted: () => void,
) {
  const invalidate = useInvalidateTimeEntryViews(organisationId);

  return useMutation({
    mutationFn: (reason?: string) =>
      deleteTimeEntry(organisationId, timeEntryId, reason),
    onSuccess: (result) => {
      if (result.ok) {
        invalidate();
        onDeleted();
      }
    },
  });
}
