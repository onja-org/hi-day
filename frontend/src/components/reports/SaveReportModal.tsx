"use client";

import { useState } from "react";
import type { FormEvent, ReactNode } from "react";
import { CaretDownIcon } from "@phosphor-icons/react";
import { ErrorMessage } from "../ErrorMessage";
import { Modal } from "../Modal";
import { Toggle } from "../Toggle";
import { ReportModalFooter } from "./ReportModalFooter";
import { ScheduleReportCallout } from "./ScheduleReportCallout";

type SaveReportModalProps = {
  onSave: (input: { name: string; scheduled: boolean }) => void;
  onClose: () => void;
  onSendPreview?: () => void;
  isPending?: boolean;
  /** A failure from the caller's save, shown above the buttons. */
  errorMessage?: string;
  /** Prefill when editing an already-saved report. */
  initialName?: string;
  initialScheduled?: boolean;
  children?: ReactNode;
};

export function SaveReportModal({
  onSave,
  onClose,
  onSendPreview,
  isPending = false,
  errorMessage,
  initialName = "",
  initialScheduled = false,
  children,
}: SaveReportModalProps) {
  const [name, setName] = useState(initialName);
  const [scheduled, setScheduled] = useState(initialScheduled);
  const trimmed = name.trim();

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (trimmed !== "") onSave({ name: trimmed, scheduled });
  }

  return (
    <Modal title="Save customized report" onClose={onClose}>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <p className="text-sm text-slate-900">
          Saved reports are saved to your account only. If you want to share
          this report with others, you can export, send, or schedule it to be
          delivered automatically.
        </p>

        <label className="flex flex-col gap-1.5 text-xs font-medium tracking-wide text-slate-900/70 uppercase">
          <span>
            Name <span className="text-error">*</span>
          </span>
          <input
            type="text"
            value={name}
            onChange={(event) => setName(event.target.value)}
            required
            placeholder="Give this report a name"
            className="h-11 rounded-brand-sm border-2 border-ink px-3 text-sm font-normal tracking-normal text-slate-900 normal-case focus:border-primary focus:ring-2 focus:ring-primary/30 focus:outline-none"
          />
        </label>

        <div className="flex flex-col gap-2 rounded-md bg-primary/5 p-3">
          <details className="group">
            <summary className="flex cursor-pointer list-none items-center justify-between text-sm font-semibold text-primary-dark">
              Saved settings
              <CaretDownIcon
                size={16}
                aria-hidden="true"
                className="transition-transform duration-150 group-open:rotate-180"
              />
            </summary>
            <div className="mt-2 text-sm text-slate-900">{children}</div>
          </details>
          <p className="text-sm text-slate-900">
            These settings will be pre-selected when you open your saved report
          </p>
        </div>

        <hr className="border-input-border" />

        <Toggle
          name="scheduled"
          label="Schedule report to be sent"
          description="Email this report to recipients on a recurring schedule."
          checked={scheduled}
          onCheckedChange={setScheduled}
        />

        <ScheduleReportCallout />

        {errorMessage && <ErrorMessage message={errorMessage} />}

        <ReportModalFooter
          onClose={onClose}
          onSendPreview={onSendPreview}
          isPending={isPending}
          submitDisabled={trimmed === ""}
        >
          Save
        </ReportModalFooter>
      </form>
    </Modal>
  );
}
