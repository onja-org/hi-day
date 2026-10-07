import type { ReactNode } from "react";
import { PaperPlaneRightIcon } from "@phosphor-icons/react";
import { Spinner } from "@/components/Spinner";

type ReportModalFooterProps = {
  onClose: () => void;
  /** Shows a "Send preview" button when given. */
  onSendPreview?: () => void;
  isPending: boolean;
  /** Disables the submit button on top of `isPending`. */
  submitDisabled?: boolean;
  /** The submit button's label. */
  children: ReactNode;
};

/** The Send preview link, Cancel and submit buttons that end the send, schedule and save report modals. */
export function ReportModalFooter({ onClose, onSendPreview, isPending, submitDisabled = false, children }: ReportModalFooterProps) {
  return (
    <div className="flex items-center justify-between gap-3">
      {onSendPreview ? (
        <button
          type="button"
          onClick={onSendPreview}
          className="flex cursor-pointer items-center gap-2 text-sm text-primary hover:underline"
        >
          <PaperPlaneRightIcon size={16} aria-hidden="true" />
          Send preview
        </button>
      ) : (
        <span />
      )}
      <div className="flex gap-3">
        <button
          type="button"
          onClick={onClose}
          className="h-11 cursor-pointer rounded-md border border-primary px-4 text-primary"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={submitDisabled || isPending}
          className="flex h-11 cursor-pointer items-center gap-2 rounded-md bg-primary px-4 text-white transition-colors duration-150 hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isPending && <Spinner />}
          {children}
        </button>
      </div>
    </div>
  );
}
