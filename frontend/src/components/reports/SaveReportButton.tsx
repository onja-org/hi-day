"use client";

import { useState } from "react";
import type { ReactNode } from "react";
import { FloppyDiskIcon } from "@phosphor-icons/react";
import { useModalSubmit } from "@/hooks/useModalSubmit";
import { SaveReportModal } from "./SaveReportModal";

type SaveReportButtonProps = {
  /** The report's current settings, listed under "Saved settings" in the modal. */
  settings: ReactNode;
  /** Prefills the modal when updating an existing saved report. */
  initialName?: string;
  initialScheduled?: boolean;
  /** Resolves with a message to keep the modal open and show it, or with nothing once handled. */
  onSave: (input: { name: string; scheduled: boolean }) => Promise<string | void>;
};

/** The primary Save button, opening the save-report modal. Closes the modal once saved. */
export function SaveReportButton({ settings, initialName, initialScheduled, onSave }: SaveReportButtonProps) {
  const [open, setOpen] = useState(false);
  const { isPending, errorMessage, submit, reset } = useModalSubmit();

  function close() {
    setOpen(false);
    reset();
  }

  return (
    <>
      <button
        type="button"
        title="Save report for easy access or to schedule delivery"
        onClick={() => setOpen(true)}
        className="flex h-11 cursor-pointer items-center gap-2 rounded-brand-sm bg-primary px-4 text-sm font-bold text-white transition-colors duration-150 hover:bg-primary/90 border-2 border-ink"
      >
        <FloppyDiskIcon size={16} aria-hidden="true" />
        Save
      </button>
      {open && (
        <SaveReportModal
          initialName={initialName}
          initialScheduled={initialScheduled}
          isPending={isPending}
          errorMessage={errorMessage}
          onSave={async (input) => {
            if (await submit(() => onSave(input))) close();
          }}
          onClose={close}
        >
          {settings}
        </SaveReportModal>
      )}
    </>
  );
}
