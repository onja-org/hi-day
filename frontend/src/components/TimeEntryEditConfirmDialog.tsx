"use client";

import type { TimeEntryChange } from "@/lib/describeTimeEntryChanges";
import { ConfirmDialog } from "./ConfirmDialog";

type TimeEntryEditConfirmDialogProps = {
  changes: TimeEntryChange[];
  isPending: boolean;
  onConfirm: () => void;
  onClose: () => void;
};

/**
 * The save step's confirmation, layered over the open edit form. It spells
 * out each field about to change rather than asking a bare "save?" — these
 * hours feed day, week and payroll totals, so the extra click earns its
 * place only by showing *what* is moving — and warns when a time change
 * reaches beyond the timesheet into the Activity views.
 */
export function TimeEntryEditConfirmDialog({
  changes,
  isPending,
  onConfirm,
  onClose,
}: TimeEntryEditConfirmDialogProps) {
  const lines = changes.map(
    (change) => `${change.label}: ${change.from} → ${change.to}`,
  );

  // Moving a boundary permanently deletes the captures left outside the new
  // span. Easy to do without realising it reaches past the timesheet, and
  // there is no undo — so the warning is blunt on purpose.
  if (changes.some((change) => change.label === "Start" || change.label === "End")) {
    lines.push(
      "",
      "Tracked apps, URLs and screenshots recorded outside the new times will be permanently deleted. This cannot be undone.",
    );
  }

  const message = lines.join("\n");

  return (
    <ConfirmDialog
      title="Save these changes?"
      message={message}
      confirmLabel="Save changes"
      isPending={isPending}
      onConfirm={onConfirm}
      onClose={onClose}
    />
  );
}
