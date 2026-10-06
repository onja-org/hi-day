"use client";

import { toDatetimeLocalValue } from "@/lib/toDatetimeLocalValue";
import type { TimeEntryFieldErrors } from "@/lib/timeEntryFieldErrors";
import { TextField } from "@/components/ui/form/TextField";

type TimeEntryTimeFieldsProps = {
  /** ISO instants, or undefined to leave the input empty. */
  startedAt?: string;
  endedAt?: string | null;
  /** The timer is still ticking, so there is no end to set yet. A *paused*
   * entry isn't this: it can be given an end, which closes it. */
  isTicking: boolean;
  /** Shown under whichever field is at fault — see `timeEntryFieldErrors`. */
  errors?: TimeEntryFieldErrors;
  onChange?: () => void;
};

/** The Start and End inputs of the time-entry form.
 *
 * Always stacked, never side by side: a datetime-local input's native width
 * doesn't shrink below its content, so two of them would overflow the
 * modal's max-w-lg even at sm: widths. */
export function TimeEntryTimeFields({
  startedAt,
  endedAt,
  isTicking,
  errors,
  onChange,
}: TimeEntryTimeFieldsProps) {
  const range = errors?.range;

  return (
    <div className="flex flex-col gap-5">
      <TextField
        label="Start"
        className="flex-1"
        inputClassName="w-full"
        name="startedAt"
        type="datetime-local"
        required
        error={errors?.startedAt}
        invalid={range !== undefined}
        onChange={onChange}
        defaultValue={startedAt ? toDatetimeLocalValue(startedAt) : undefined}
      />

      {isTicking ? (
        <p className="text-sm text-slate-900/60">
          This timer is still running, so it has no end time yet — pause or
          stop it to set one.
        </p>
      ) : (
        <TextField
          label="End"
          className="flex-1"
          inputClassName="w-full"
          name="endedAt"
          type="datetime-local"
          required
          error={errors?.endedAt ?? range}
          onChange={onChange}
          defaultValue={endedAt ? toDatetimeLocalValue(endedAt) : undefined}
        />
      )}
    </div>
  );
}
