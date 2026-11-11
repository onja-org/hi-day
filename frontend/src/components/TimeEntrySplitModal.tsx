"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useInvalidateTimeEntryViews } from "@/hooks/useInvalidateTimeEntryViews";
import { useRequireTimeEntryReason } from "@/hooks/useRequireTimeEntryReason";
import { cutTimeEntryRange } from "@/lib/cutTimeEntryRange";
import { entryTitle } from "@/lib/entryProjectDisplay";
import { formatClockTime } from "@/lib/formatClockTime";
import { previewRangeCut } from "@/lib/previewRangeCut";
import { toDatetimeLocalValue } from "@/lib/toDatetimeLocalValue";
import type { CutMode, TimeEntryListItem } from "@/types/timeEntry";
import { ErrorMessage } from "./ErrorMessage";
import { Modal } from "./Modal";
import { Spinner } from "./Spinner";
import { TimeEntryRangeCutPreview } from "./TimeEntryRangeCutPreview";
import { TimeEntryReasonField } from "./TimeEntryReasonField";

type TimeEntrySplitModalProps = {
  organisationId: string;
  entry: TimeEntryListItem;
  onClose: () => void;
};

const MODES: { value: CutMode; label: string }[] = [
  { value: "remove", label: "Remove this time" },
  { value: "split", label: "Split into three entries" },
];

/** A point `fraction` of the way through the entry, as an input value. */
function pointIn(entry: TimeEntryListItem, endedAt: string, fraction: number): string {
  const start = new Date(entry.startedAt).getTime();
  const end = new Date(endedAt).getTime();
  return toDatetimeLocalValue(new Date(start + (end - start) * fraction).toISOString());
}

/**
 * Takes a typed time range inside one entry and either removes it, keeping
 * the time before and after as separate entries, or splits the entry there
 * into three. A preview shows what will be left before anything is saved,
 * since there is no undo.
 */
export function TimeEntrySplitModal({ organisationId, entry, onClose }: TimeEntrySplitModalProps) {
  const endedAt = entry.endedAt ?? entry.startedAt;
  // Opens on the middle third, a range the preview always accepts.
  const [from, setFrom] = useState(() => pointIn(entry, endedAt, 1 / 3));
  const [to, setTo] = useState(() => pointIn(entry, endedAt, 2 / 3));
  const [mode, setMode] = useState<CutMode>("remove");
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const isReasonRequired = useRequireTimeEntryReason();
  const invalidate = useInvalidateTimeEntryViews(organisationId);

  const preview = previewRangeCut({ ...entry, endedAt }, from, to, mode);
  const needsReason = mode === "remove" && isReasonRequired && reason.trim() === "";

  const cutMutation = useMutation({
    mutationFn: (range: { from: string; to: string }) =>
      cutTimeEntryRange(organisationId, entry.id, {
        ...range,
        mode,
        reason: reason.trim() || undefined,
      }),
    onSuccess: (result) => {
      if (result.ok) {
        invalidate();
        onClose();
        return;
      }
      setError(result.message);
    },
  });

  return (
    <Modal title="Split or remove time" onClose={onClose}>
      <div className="flex w-full max-w-lg flex-col gap-5">
        <p className="text-sm text-slate-900">
          {entryTitle(entry) && `${entryTitle(entry)} · `}
          {formatClockTime(entry.startedAt)} – {formatClockTime(endedAt)}
        </p>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {[
            { label: "From", value: from, onChange: setFrom },
            { label: "To", value: to, onChange: setTo },
          ].map((field) => (
            <label key={field.label} className="flex flex-col gap-1.5">
              {field.label}
              <input
                type="datetime-local"
                value={field.value}
                onChange={(event) => field.onChange(event.target.value)}
                className="w-full rounded-brand-sm border-2 border-ink bg-white px-3 h-11 text-slate-900 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </label>
          ))}
        </div>

        <fieldset className="flex flex-wrap gap-5 text-sm">
          <legend className="sr-only">What to do with this time</legend>
          {MODES.map((option) => (
            <label key={option.value} className="flex cursor-pointer items-center gap-2 text-slate-900">
              <input
                type="radio"
                name="cutMode"
                checked={mode === option.value}
                onChange={() => setMode(option.value)}
                className="accent-primary"
              />
              {option.label}
            </label>
          ))}
        </fieldset>

        {preview.ok ? (
          <TimeEntryRangeCutPreview pieces={preview.pieces} />
        ) : (
          <p className="text-sm text-error">{preview.message}</p>
        )}

        {mode === "remove" && (
          <TimeEntryReasonField organisationId={organisationId} value={reason} onChange={setReason} />
        )}

        {error && <ErrorMessage message={error} />}

        <button
          type="button"
          onClick={() => preview.ok && cutMutation.mutate({ from: preview.from, to: preview.to })}
          disabled={!preview.ok || needsReason || cutMutation.isPending}
          className="flex cursor-pointer items-center justify-center gap-2 rounded-brand-sm bg-primary px-4 h-11 text-white transition-colors duration-150 hover:bg-primary/90 disabled:cursor-not-allowed disabled:bg-primary/50 border-2 border-ink font-bold"
        >
          {cutMutation.isPending && <Spinner />}
          {mode === "remove" ? "Remove time" : "Split entry"}
        </button>
      </div>
    </Modal>
  );
}
