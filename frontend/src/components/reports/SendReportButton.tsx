"use client";

import { useState } from "react";
import { PaperPlaneRightIcon } from "@phosphor-icons/react";
import type { SendReportInput } from "@/types/sendReport";
import { SendReportModal } from "./SendReportModal";

type SendReportButtonProps = {
  defaultSubject: string;
  /** Resolves with a message to keep the modal open and show it, or with nothing once sent. */
  onSend: (input: SendReportInput) => Promise<string | void>;
};

/** An icon button that opens the send-report modal. */
export function SendReportButton({ defaultSubject, onSend }: SendReportButtonProps) {
  const [open, setOpen] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | undefined>();
  const [isPending, setIsPending] = useState(false);

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
          isPending={isPending}
          onClose={close}
          onSend={async (input) => {
            setIsPending(true);
            setErrorMessage(undefined);
            const failure = await onSend(input);
            setIsPending(false);
            if (failure) setErrorMessage(failure);
            else close();
          }}
        />
      )}
    </>
  );
}
