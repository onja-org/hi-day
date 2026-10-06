"use client";

import { useState } from "react";
import type { FormEvent } from "react";
import { ErrorMessage } from "@/components/ErrorMessage";
import { Modal } from "@/components/Modal";
import { TextareaField } from "@/components/ui/form/TextareaField";
import { TextField } from "@/components/ui/form/TextField";
import { validateReportEmails } from "@/lib/validateReportEmails";
import type { SendReportFileType, SendReportInput } from "@/types/sendReport";
import { FileTypeSelect } from "./FileTypeSelect";
import { ReportModalFooter } from "./ReportModalFooter";

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
    const { emails, error } = validateReportEmails(addresses);
    if (emails.length === 0 || subject.trim() === "") return;
    if (error) {
      setValidationError(error);
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
        <FileTypeSelect label="File type" value={fileType} onChange={setFileType} />

        {(validationError ?? errorMessage) && <ErrorMessage message={validationError ?? errorMessage ?? ""} />}

        <ReportModalFooter onClose={onClose} onSendPreview={onSendPreview} isPending={isPending}>
          Send
        </ReportModalFooter>
      </form>
    </Modal>
  );
}
