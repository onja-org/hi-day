"use client";

import { useState } from "react";
import type { ReactNode } from "react";
import { FloppyDiskIcon } from "@phosphor-icons/react";
import { SaveReportModal } from "./SaveReportModal";

type SaveReportButtonProps = {
  /** The report's current settings, listed under "Saved settings" in the modal. */
  settings: ReactNode;
  /** Prefills the modal when updating an existing saved report. */
  initialName?: string;
  initialScheduled?: boolean;
  onSave: (input: { name: string; scheduled: boolean }) => void;
};

/** The primary Save button, opening the save-report modal. Closes the modal once saved. */
export function SaveReportButton({ settings, initialName, initialScheduled, onSave }: SaveReportButtonProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        title="Save report for easy access or to schedule delivery"
        onClick={() => setOpen(true)}
        className="flex h-11 cursor-pointer items-center gap-2 rounded-md bg-primary px-4 text-sm font-medium text-white transition-colors duration-150 hover:bg-primary/90"
      >
        <FloppyDiskIcon size={16} aria-hidden="true" />
        Save
      </button>
      {open && (
        <SaveReportModal
          initialName={initialName}
          initialScheduled={initialScheduled}
          onSave={(input) => {
            onSave(input);
            setOpen(false);
          }}
          onClose={() => setOpen(false)}
        >
          {settings}
        </SaveReportModal>
      )}
    </>
  );
}
