"use client";

import { useState } from "react";
import { PencilSimple, Trash, X } from "@phosphor-icons/react";
import { Spinner } from "@/components/Spinner";
import type { TimesheetReason } from "@/types/timesheetReason";

type TimesheetReasonRowProps = {
  reason: TimesheetReason;
  onRename: (label: string) => void;
  onDelete: () => void;
  isBusy: boolean;
};

/** One row of the Reasons list, read-only until the pencil turns it into an
 * inline rename field. */
export function TimesheetReasonRow({
  reason,
  onRename,
  onDelete,
  isBusy,
}: TimesheetReasonRowProps) {
  const [draft, setDraft] = useState<string | null>(null);
  const isEditing = draft !== null;

  function save() {
    const label = (draft ?? "").trim();
    setDraft(null);
    if (label !== "" && label !== reason.label) {
      onRename(label);
    }
  }

  return (
    <li className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
      {isEditing ? (
        <input
          type="text"
          autoFocus
          value={draft}
          maxLength={100}
          aria-label={`Rename ${reason.label}`}
          onChange={(event) => setDraft(event.target.value)}
          onBlur={save}
          onKeyDown={(event) => {
            if (event.key === "Enter") save();
            if (event.key === "Escape") setDraft(null);
          }}
          className="min-w-0 flex-1 rounded-brand-sm border-2 border-ink bg-white px-3 py-1.5 text-slate-900 focus:border-primary focus:ring-2 focus:ring-primary/30 focus:outline-none"
        />
      ) : (
        <span className="min-w-0 flex-1 truncate text-slate-900">
          {reason.label}
        </span>
      )}

      <span className="flex items-center gap-1">
        {isBusy && <Spinner className="text-primary-dark" />}
        {isEditing ? (
          <button
            type="button"
            aria-label={`Stop renaming ${reason.label}`}
            onClick={() => setDraft(null)}
            className="cursor-pointer rounded-brand-sm p-1.5 text-slate-900/60 hover:bg-cream hover:text-primary-dark"
          >
            <X size={18} aria-hidden="true" />
          </button>
        ) : (
          <button
            type="button"
            aria-label={`Rename ${reason.label}`}
            onClick={() => setDraft(reason.label)}
            className="cursor-pointer rounded-brand-sm p-1.5 text-slate-900/60 hover:bg-cream hover:text-primary-dark"
          >
            <PencilSimple size={18} aria-hidden="true" />
          </button>
        )}
        <button
          type="button"
          aria-label={`Delete ${reason.label}`}
          onClick={onDelete}
          className="cursor-pointer rounded-brand-sm p-1.5 text-slate-900/60 hover:bg-cream hover:text-error"
        >
          <Trash size={18} aria-hidden="true" />
        </button>
      </span>
    </li>
  );
}
