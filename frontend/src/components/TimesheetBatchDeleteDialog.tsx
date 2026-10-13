"use client";

import { useState } from "react";
import { useRequireTimeEntryReason } from "@/hooks/useRequireTimeEntryReason";
import { Modal } from "./Modal";
import { Spinner } from "./Spinner";
import { TimeEntryReasonField } from "./TimeEntryReasonField";

type TimesheetBatchDeleteDialogProps = {
  organisationId: string;
  count: number;
  isPending: boolean;
  onConfirm: (reason: string | undefined) => void;
  onClose: () => void;
};

/**
 * Confirms a batch delete, asking once why — the one reason is recorded on
 * every deleted entry. Compulsory when the organisation's Require reason is
 * on, as for a single delete; the API holds it to that either way.
 */
export function TimesheetBatchDeleteDialog({
  organisationId,
  count,
  isPending,
  onConfirm,
  onClose,
}: TimesheetBatchDeleteDialogProps) {
  const [reason, setReason] = useState("");
  const isReasonRequired = useRequireTimeEntryReason();
  const trimmedReason = reason.trim();
  const noun = count === 1 ? "time entry" : "time entries";

  return (
    <Modal title={`Delete ${count} ${noun}?`} onClose={onClose}>
      <div className="flex flex-col gap-5">
        <p className="text-slate-900">
          This removes {count === 1 ? "it" : "them"} from the day and week
          totals. It cannot be undone.
        </p>

        <TimeEntryReasonField
          organisationId={organisationId}
          value={reason}
          onChange={setReason}
        />

        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="cursor-pointer rounded-brand-sm border-2 border-ink px-4 h-11 text-sm font-semibold text-slate-900 transition-colors duration-150 hover:bg-cream"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={(isReasonRequired && trimmedReason === "") || isPending}
            onClick={() => onConfirm(trimmedReason || undefined)}
            className="flex cursor-pointer items-center gap-2 rounded-brand-sm bg-error px-4 h-11 text-sm font-bold text-white transition-colors duration-150 hover:bg-error/90 disabled:cursor-not-allowed disabled:bg-error/40 border-2 border-ink"
          >
            {isPending && <Spinner />}
            Delete {count} {noun}
          </button>
        </div>
      </div>
    </Modal>
  );
}
