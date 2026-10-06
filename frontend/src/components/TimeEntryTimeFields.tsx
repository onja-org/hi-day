"use client";

import type { ChangeEvent } from "react";
import { useEffect, useState } from "react";
import { clampDatetimeLocal } from "@/lib/clampDatetimeLocal";
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

/** How often `max` catches up with the clock while the form sits open. */
const NOW_REFRESH_MS = 30_000;

function nowValue(): string {
  return toDatetimeLocalValue(new Date().toISOString());
}

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
  // Time that hasn't happened yet can't be worked, so the picker doesn't
  // offer it: `max` greys out later days in the calendar and the browser
  // refuses a later value on submit, which stops the round-trip to the
  // server that used to be the only thing saying so.
  const [max, setMax] = useState(nowValue);

  useEffect(() => {
    // Fixed at mount, `max` would start refusing the real current minute a
    // few minutes into filling the form in — the opposite of the point.
    const handle = setInterval(() => setMax(nowValue()), NOW_REFRESH_MS);
    return () => clearInterval(handle);
  }, []);

  // `max` stops the calendar offering a later day, but the time spinner
  // still winds past the current hour — so a later time is pulled back as
  // it is set, rather than left to be refused on submit.
  function handleChange(event: ChangeEvent<HTMLInputElement>): void {
    event.target.value = clampDatetimeLocal(event.target.value, max);
    onChange?.();
  }

  return (
    <div className="flex flex-col gap-5">
      <TextField
        label="Start"
        className="flex-1"
        inputClassName="w-full"
        name="startedAt"
        type="datetime-local"
        max={max}
        required
        error={errors?.startedAt}
        invalid={range !== undefined}
        onChange={handleChange}
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
          max={max}
          required
          error={errors?.endedAt ?? range}
          onChange={handleChange}
          defaultValue={endedAt ? toDatetimeLocalValue(endedAt) : undefined}
        />
      )}
    </div>
  );
}
