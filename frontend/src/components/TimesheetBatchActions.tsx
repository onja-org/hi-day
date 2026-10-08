"use client";

import { useRef, useState } from "react";
import { CaretDownIcon } from "@phosphor-icons/react";
import clsx from "clsx";
import { useDeleteTimeEntries } from "@/hooks/useDeleteTimeEntries";
import { useDismissOnOutside } from "@/hooks/useDismissOnOutside";
import { ConfirmDialog } from "./ConfirmDialog";

type TimesheetBatchActionsProps = {
  organisationId: string;
  selectedIds: string[];
  onDeleted: () => void;
};

/**
 * Acts on every ticked row at once. Delete is the only batch action — edit
 * and split each need per-entry input.
 *
 * With nothing ticked it turns *invisible* rather than unmounting, so it
 * keeps its place in the layout and the table below doesn't jump every time
 * a selection is made or cleared. Disabled at the same time, so it can't be
 * reached by click or keyboard while it can't be seen.
 *
 * Shown to everyone: whether a given delete is allowed is decided per entry
 * by the backend, which says so in the result rather than the button
 * quietly disappearing.
 */
export function TimesheetBatchActions({
  organisationId,
  selectedIds,
  onDeleted,
}: TimesheetBatchActionsProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const deleteMutation = useDeleteTimeEntries(organisationId, () => {
    setIsConfirming(false);
    onDeleted();
  });

  useDismissOnOutside(isOpen, [containerRef], () => setIsOpen(false));

  const count = selectedIds.length;
  const noun = count === 1 ? "time entry" : "time entries";
  const isEmpty = count === 0;

  return (
    <div ref={containerRef} className="relative inline-block text-left">
      <button
        type="button"
        onClick={() => setIsOpen((open) => !open)}
        disabled={isEmpty}
        aria-hidden={isEmpty}
        aria-expanded={isOpen}
        aria-haspopup="menu"
        className={clsx(
          "inline-flex cursor-pointer items-center gap-2 rounded-brand-sm border-2 border-ink bg-white px-4 h-11 text-sm font-semibold text-slate-900 transition-colors duration-150 hover:border-primary hover:text-primary",
          isEmpty && "invisible",
        )}
      >
        Batch actions
        {!isEmpty && <span className="tabular-nums">({count})</span>}
        <CaretDownIcon size={12} aria-hidden="true" />
      </button>

      {isOpen && (
        <div
          role="menu"
          className="absolute top-full left-0 z-20 mt-1 flex w-44 flex-col items-stretch rounded-brand-sm border-2 border-ink bg-white shadow-hard-sm"
        >
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setIsOpen(false);
              setIsConfirming(true);
            }}
            className="cursor-pointer px-3 py-2 text-left text-sm text-error transition-colors duration-150 hover:bg-cream"
          >
            Delete selected
          </button>
        </div>
      )}

      {isConfirming && (
        <ConfirmDialog
          title={`Delete ${count} ${noun}?`}
          message={`This removes ${count === 1 ? "it" : "them"} from the day and week totals. It cannot be undone.`}
          confirmLabel={`Delete ${count} ${noun}`}
          isDangerous
          isPending={deleteMutation.isPending}
          onConfirm={() => deleteMutation.mutate(selectedIds)}
          onClose={() => setIsConfirming(false)}
        />
      )}
    </div>
  );
}
