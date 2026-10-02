"use client";

import { useState } from "react";
import type { FormEvent } from "react";
import { PaperPlaneRightIcon } from "@phosphor-icons/react";
import { ErrorMessage } from "@/components/ErrorMessage";
import { Modal } from "@/components/Modal";
import { Spinner } from "@/components/Spinner";
import { SelectField } from "@/components/ui/form/SelectField";
import { TextareaField } from "@/components/ui/form/TextareaField";
import { TextField } from "@/components/ui/form/TextField";
import { findInvalidEmails } from "@/lib/findInvalidEmails";
import { parseInviteEmails } from "@/lib/parseInviteEmails";
import type { SendReportFileType, SendReportInput } from "@/types/sendReport";

type SendReportModalProps = {
  onSend: (input: SendReportInput) => void;
  onClose: () => void;
  /** Shows a "Send preview" button when given. */
  onSendPreview?: () => void;
  isPending?: boolean;
  /** A failure from the caller's send, shown above the buttons. */
  errorMessage?: string;
  defaultSubject?: string;
};

export function SendReportModal({
  onSend,
  onClose,
  onSendPreview,
  isPending = false,
  errorMessage,
  defaultSubject = "",
}: SendReportModalProps) {
  const [addresses, setAddresses] = useState("");
  const [subject, setSubject] = useState(defaultSubject);
  const [message, setMessage] = useState("");
  const [fileType, setFileType] = useState<SendReportFileType>("pdf");
  const [validationError, setValidationError] = useState<string | null>(null);

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const emails = parseInviteEmails(addresses);
    const invalid = findInvalidEmails(emails);
    if (emails.length === 0 || subject.trim() === "") return;
    if (invalid.length > 0) {
      setValidationError(`Not a valid email address: ${invalid.join(", ")}`);
      return;
    }
    setValidationError(null);
    onSend({ emails, subject: subject.trim(), message: message.trim(), fileType });
  }

  return (
    <Modal title="Send Report" onClose={onClose}>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <TextField
          label="Email addresses *"
          type="text"
          value={addresses}
          onChange={(event) => setAddresses(event.target.value)}
          required
          placeholder="Enter addresses"
          hint="Separate email addresses with commas"
        />
        <TextField
          label="Subject *"
          type="text"
          value={subject}
          onChange={(event) => setSubject(event.target.value)}
          required
          placeholder="Enter email subject line"
        />
        <TextareaField
          label="Message"
          value={message}
          onChange={(event) => setMessage(event.target.value)}
          rows={3}
          placeholder="Enter message"
        />
        <SelectField
          label="File type"
          value={fileType}
          onChange={(event) => setFileType(event.target.value as SendReportFileType)}
        >
          <option value="pdf">PDF</option>
          <option value="csv">CSV</option>
        </SelectField>

        {(validationError ?? errorMessage) && <ErrorMessage message={validationError ?? errorMessage ?? ""} />}

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
              disabled={isPending}
              className="flex h-11 cursor-pointer items-center gap-2 rounded-md bg-primary px-4 text-white transition-colors duration-150 hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isPending && <Spinner />}
              Send
            </button>
          </div>
        </div>
      </form>
    </Modal>
  );
}
