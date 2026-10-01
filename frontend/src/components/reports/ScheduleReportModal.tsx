"use client";

import { useState } from "react";
import type { FormEvent } from "react";
import { PaperPlaneRightIcon } from "@phosphor-icons/react";
import { DATE_RANGE_PRESET_LABELS } from "@/components/DateRangePresetList";
import { ErrorMessage } from "@/components/ErrorMessage";
import { Modal } from "@/components/Modal";
import { Spinner } from "@/components/Spinner";
import { SelectField } from "@/components/ui/form/SelectField";
import { TextareaField } from "@/components/ui/form/TextareaField";
import { TextField } from "@/components/ui/form/TextField";
import { findInvalidEmails } from "@/lib/findInvalidEmails";
import { formatScheduleHour } from "@/lib/formatScheduleHour";
import { parseInviteEmails } from "@/lib/parseInviteEmails";
import { SCHEDULE_FREQUENCIES } from "@/lib/scheduleOptions";
import type { DateRangePreset } from "@/types/dateRange";
import type { ReportSchedule, ScheduleFrequency, ScheduleReportInput } from "@/types/reportSchedule";
import type { SendReportFileType } from "@/types/sendReport";
import { ReportCallout } from "./ReportCallout";
import { ScheduleDayPicker } from "./ScheduleDayPicker";

type ScheduleReportModalProps = {
  onSchedule: (input: ScheduleReportInput) => void;
  onClose: () => void;
  /** Shows a "Send preview" button when given. */
  onSendPreview?: () => void;
  isPending?: boolean;
  /** A failure from the caller's save, shown with the form's own validation errors. */
  errorMessage?: string;
  /** Prefill when editing an already-scheduled report. */
  initialName?: string;
  initialSchedule?: ReportSchedule;
};

const HOURS = Array.from({ length: 24 }, (_, hour) => hour);

export function ScheduleReportModal({
  onSchedule,
  onClose,
  onSendPreview,
  isPending = false,
  errorMessage,
  initialName = "",
  initialSchedule,
}: ScheduleReportModalProps) {
  const [name, setName] = useState(initialName);
  const [addresses, setAddresses] = useState(initialSchedule?.emails.join(", ") ?? "");
  const [message, setMessage] = useState(initialSchedule?.message ?? "");
  const [fileType, setFileType] = useState<SendReportFileType>(initialSchedule?.fileType ?? "pdf");
  const [dateRange, setDateRange] = useState<DateRangePreset>(initialSchedule?.dateRange ?? "last_7_days");
  const [frequency, setFrequency] = useState<ScheduleFrequency | "">(initialSchedule?.frequency ?? "");
  const [hour, setHour] = useState(initialSchedule ? String(initialSchedule.hour) : "");
  const [days, setDays] = useState<number[]>(initialSchedule?.days ?? []);
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const emails = parseInviteEmails(addresses);
    const invalid = findInvalidEmails(emails);
    if (emails.length === 0 || frequency === "" || hour === "") return;
    if (invalid.length > 0) return setError(`Not a valid email address: ${invalid.join(", ")}`);
    if (days.length === 0) return setError("Choose at least one delivery day.");
    setError(null);
    onSchedule({
      name: name.trim(),
      emails,
      message: message.trim(),
      fileType,
      dateRange,
      frequency,
      hour: Number(hour),
      days: [...days].sort(),
    });
  }

  return (
    <Modal title="Schedule report" onClose={onClose}>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <TextField label="Name *" value={name} onChange={(e) => setName(e.target.value)} required placeholder="Give this report a name" />
        <TextField
          label="Email addresses *"
          value={addresses}
          onChange={(e) => setAddresses(e.target.value)}
          required
          placeholder="Enter addresses"
          hint="Separate email addresses with commas"
        />
        <TextareaField label="Message *" value={message} onChange={(e) => setMessage(e.target.value)} required rows={3} placeholder="Enter a message" />

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <SelectField label="File type *" value={fileType} onChange={(e) => setFileType(e.target.value as SendReportFileType)}>
            <option value="pdf">PDF</option>
            <option value="csv">CSV</option>
          </SelectField>
          <SelectField label="Date range" value={dateRange} onChange={(e) => setDateRange(e.target.value as DateRangePreset)}>
            {Object.entries(DATE_RANGE_PRESET_LABELS).map(([preset, label]) => (
              <option key={preset} value={preset}>
                {label}
              </option>
            ))}
          </SelectField>
          <SelectField label="Delivery frequency *" value={frequency} onChange={(e) => setFrequency(e.target.value as ScheduleFrequency)} required>
            <option value="" disabled>
              Select
            </option>
            {SCHEDULE_FREQUENCIES.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </SelectField>
          <SelectField label="Delivery time *" value={hour} onChange={(e) => setHour(e.target.value)} required>
            <option value="" disabled>
              Select
            </option>
            {HOURS.map((value) => (
              <option key={value} value={value}>
                {formatScheduleHour(value)}
              </option>
            ))}
          </SelectField>
        </div>

        <ScheduleDayPicker selected={days} onChange={setDays} />

        <ReportCallout title="Scheduled reports will be saved">
          Scheduled reports will be saved along with other customized reports. Access them through
          the All Reports or Customized Reports pages.
        </ReportCallout>

        {(error ?? errorMessage) && <ErrorMessage message={error ?? errorMessage ?? ""} />}

        <div className="flex items-center justify-between gap-3">
          {onSendPreview ? (
            <button type="button" onClick={onSendPreview} className="flex cursor-pointer items-center gap-2 text-sm text-primary hover:underline">
              <PaperPlaneRightIcon size={16} aria-hidden="true" />
              Send preview
            </button>
          ) : (
            <span />
          )}
          <div className="flex gap-3">
            <button type="button" onClick={onClose} className="h-11 cursor-pointer rounded-md border border-primary px-4 text-primary">
              Cancel
            </button>
            <button
              type="submit"
              disabled={isPending}
              className="flex h-11 cursor-pointer items-center gap-2 rounded-md bg-primary px-4 text-white transition-colors duration-150 hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isPending && <Spinner />}
              Schedule &amp; Save
            </button>
          </div>
        </div>
      </form>
    </Modal>
  );
}
