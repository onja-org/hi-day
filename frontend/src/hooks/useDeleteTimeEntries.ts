import { useMutation } from "@tanstack/react-query";
import { deleteTimeEntry } from "@/lib/deleteTimeEntry";
import type { ApiResult } from "@/types/api";
import { useInvalidateTimeEntryViews } from "./useInvalidateTimeEntryViews";

/** An ApiResult so the app's global mutation toast reports it like any
 * other mutation, plus how many entries actually went. */
export type BatchDeleteResult = ApiResult<{ deleted: number }, { deleted: number }>;

function summarise(deleted: number, failureMessage: string | null): BatchDeleteResult {
  const noun = deleted === 1 ? "time entry" : "time entries";
  if (!failureMessage) {
    return { ok: true, message: `${deleted} ${noun} deleted`, deleted };
  }
  if (deleted === 0) {
    return { ok: false, message: failureMessage, deleted };
  }
  // Partly applied — a flat success or failure would misdescribe what is
  // now in the database.
  return {
    ok: false,
    message: `${deleted} ${noun} deleted, the rest could not be: ${failureMessage}`,
    deleted,
  };
}

/**
 * Deletes several Time entries at once. There is no bulk endpoint, so this
 * issues one DELETE per entry and a batch can be *partly* applied — some
 * gone, others refused (deleting someone else's without being an admin) —
 * hence a count rather than an all-or-nothing claim.
 *
 * Only the first failure's message is surfaced: refusals in one batch are
 * nearly always the same reason, so repeating it adds nothing.
 */
export function useDeleteTimeEntries(
  organisationId: string,
  onFinished: () => void,
) {
  const invalidate = useInvalidateTimeEntryViews(organisationId);

  return useMutation({
    mutationFn: async (timeEntryIds: string[]): Promise<BatchDeleteResult> => {
      const results = await Promise.all(
        timeEntryIds.map((id) => deleteTimeEntry(organisationId, id)),
      );
      const failures = results.filter((result) => !result.ok);
      return summarise(results.length - failures.length, failures[0]?.message ?? null);
    },
    onSuccess: () => {
      invalidate();
      onFinished();
    },
  });
}
