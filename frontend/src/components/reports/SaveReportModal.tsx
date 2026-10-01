"use client";

import { useState } from "react";
import type { FormEvent, ReactNode } from "react";
import { CaretDownIcon, PaperPlaneRightIcon } from "@phosphor-icons/react";
import { Modal } from "../Modal";
import { Spinner } from "../Spinner";
import { Toggle } from "../Toggle";
import { ScheduleReportCallout } from "./ScheduleReportCallout";

type SaveReportModalProps = {
  onSave: (input: { name: string; scheduled: boolean }) => void;
  onClose: () => void;
  onSendPreview?: () => void;
  isPending?: boolean;
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
            className="h-11 rounded-md border border-input-border px-3 text-sm font-normal tracking-normal text-slate-900 normal-case focus:border-primary focus:ring-2 focus:ring-primary/30 focus:outline-none"
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
              disabled={trimmed === "" || isPending}
              className="flex h-11 cursor-pointer items-center gap-2 rounded-md bg-primary px-4 text-white transition-colors duration-150 hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isPending && <Spinner />}
              Save
            </button>
          </div>
        </div>
      </form>
    </Modal>
  );
}
