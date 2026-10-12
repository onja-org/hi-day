"use client";

import { useState } from "react";
import { useRequireTimeEntryReason } from "@/hooks/useRequireTimeEntryReason";
import { useTimesheetReasons } from "@/hooks/useTimesheetReasons";

/** What the picker holds while someone types their own wording. */
const OTHER = "__other__";

type TimeEntryReasonFieldProps = {
  organisationId: string;
  value: string;
  onChange: (value: string) => void;
};

/**
 * Why a time entry is being added, changed or deleted; kept on the audit row
 * and shown in the Manual time edits report.
 *
 * Pick one of the organisation's Reasons, or "Other" to type your own. Either
 * way the *wording* is what's recorded, never a reference to the Reason, so
 * renaming or deleting one later leaves this entry's record exactly as it
 * reads today. With no Reasons configured it degrades to the plain free-text
 * box it has always been.
 */
export function TimeEntryReasonField({
  organisationId,
  value,
  onChange,
}: TimeEntryReasonFieldProps) {
  const reasonsQuery = useTimesheetReasons(organisationId);
  const isRequired = useRequireTimeEntryReason();
  const [isOther, setIsOther] = useState(false);

  const reasons = reasonsQuery.data ?? [];
  const isListed = reasons.some((reason) => reason.label === value);
  // Free text when there's no list to pick from, when "Other…" was chosen,
  // or when the value came from somewhere that isn't on the list.
  const isFreeText =
    reasons.length === 0 || isOther || (value !== "" && !isListed);

  return (
    <div className="flex flex-col gap-1.5">
      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-medium text-slate-900">
          Reason{isRequired && "*"}
        </span>
        {reasons.length > 0 && (
          <select
            value={isFreeText ? OTHER : value}
            onChange={(event) => {
              const next = event.target.value;
              setIsOther(next === OTHER);
              onChange(next === OTHER ? "" : next);
            }}
            className="w-full rounded-brand-sm border-2 border-ink bg-white px-3 py-2 text-slate-900 focus:border-primary focus:ring-2 focus:ring-primary/30 focus:outline-none"
          >
            <option value="">Select a reason…</option>
            {reasons.map((reason) => (
              <option key={reason.id} value={reason.label}>
                {reason.label}
              </option>
            ))}
            <option value={OTHER}>Other…</option>
          </select>
        )}
      </label>

      {isFreeText && (
        <textarea
          value={value}
          onChange={(event) => onChange(event.target.value)}
          rows={3}
          maxLength={500}
          aria-label="Reason"
          placeholder="Why are you changing this time entry? (ex: Forgot to stop timer)"
          className="w-full rounded-brand-sm border-2 border-ink bg-white px-3 py-2 text-slate-900 focus:border-primary focus:ring-2 focus:ring-primary/30 focus:outline-none"
        />
      )}
    </div>
  );
}
