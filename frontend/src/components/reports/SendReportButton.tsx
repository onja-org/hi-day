"use client";

import { useState } from "react";
import { PaperPlaneRightIcon } from "@phosphor-icons/react";
import type { SendReportInput } from "@/types/sendReport";
import { SendReportModal } from "./SendReportModal";

type SendReportButtonProps = {
  defaultSubject: string;
  /** Throw or return a message to keep the modal open and show it; return nothing once sent. */
  onSend: (input: SendReportInput) => string | void;
};

/** An icon button that opens the send-report modal. */
export function SendReportButton({ defaultSubject, onSend }: SendReportButtonProps) {
  const [open, setOpen] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | undefined>();

  function close() {
    setOpen(false);
    setErrorMessage(undefined);
  }

  return (
    <>
      <button
        type="button"
        aria-label="Send report"
        title="Send report by email"
        onClick={() => setOpen(true)}
        className="flex size-11 cursor-pointer items-center justify-center rounded-md border border-input-border text-primary transition-colors duration-150 hover:border-primary"
      >
        <PaperPlaneRightIcon size={16} aria-hidden="true" />
      </button>
      {open && (
        <SendReportModal
          defaultSubject={defaultSubject}
          errorMessage={errorMessage}
          onClose={close}
          onSend={(input) => {
            const failure = onSend(input);
            if (failure) setErrorMessage(failure);
            else close();
          }}
        />
      )}
    </>
  );
}
