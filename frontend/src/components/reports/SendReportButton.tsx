"use client";

import { useState } from "react";
import { PaperPlaneRightIcon } from "@phosphor-icons/react";
import { useModalSubmit } from "@/hooks/useModalSubmit";
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
  const sending = useModalSubmit();

  function close() {
    setOpen(false);
    sending.reset();
  }

  return (
    <>
      <button
        type="button"
        aria-label="Send report"
        title="Send report by email"
        onClick={() => setOpen(true)}
        className="flex size-11 cursor-pointer items-center justify-center rounded-brand-sm border-2 border-ink text-primary transition-colors duration-150 hover:border-primary font-semibold"
      >
        <PaperPlaneRightIcon size={16} aria-hidden="true" />
      </button>
      {open && (
        <SendReportModal
          defaultSubject={defaultSubject}
          errorMessage={sending.errorMessage}
          isPending={sending.isPending}
          onClose={close}
          onSend={async (input) => {
            if (await sending.submit(() => onSend(input))) close();
          }}
        />
      )}
    </>
  );
}
