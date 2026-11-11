"use client";

import { useState, type MouseEvent } from "react";
import { toDatetimeLocalValue } from "@/lib/toDatetimeLocalValue";
import { timeRangeFromParts, timeRangeToParts } from "@/lib/timeRangeParts";
import type { TimeRangeParts } from "@/lib/timeRangeParts";
import type { TimeEntryFieldErrors } from "@/lib/timeEntryFieldErrors";
import { TextField } from "@/components/ui/form/TextField";

type TimeEntryTimeFieldsProps = {
  /** ISO instants, or undefined to leave the fields empty. */
  startedAt?: string;
  endedAt?: string | null;
  /** The timer is still ticking, so there is no end to set yet. A *paused*
   * entry isn't this: it can be given an end, which closes it. */
  isTicking: boolean;
  /** Shown under whichever field is at fault — see `timeEntryFieldErrors`. */
  errors?: TimeEntryFieldErrors;
  /** Both current values, so the form can judge them as they are typed. */
  onChange?: (startedAt: string, endedAt: string) => void;
};

/** Opens a field's picker from a click anywhere on it, not just the small
 * icon at its edge. Typing into it is unaffected. */
function openPicker(event: MouseEvent<HTMLInputElement>): void {
  try {
    event.currentTarget.showPicker();
  } catch {
    // No picker to show, or one already open — the field still takes typing.
  }
}

/** The one date and the two times of day a time entry is written as. */
export function TimeEntryTimeFields({
  startedAt,
  endedAt,
  isTicking,
  errors,
  onChange,
}: TimeEntryTimeFieldsProps) {
  const [today] = useState(() =>
    toDatetimeLocalValue(new Date().toISOString()).slice(0, 10),
  );
  // A new entry opens on today, the day it almost always belongs to; an
  // existing one keeps its own. Neither fills in a time.
  const [parts, setParts] = useState(() => {
    const initial = timeRangeToParts(startedAt, endedAt);
    return initial.date === "" ? { ...initial, date: today } : initial;
  });

  const rangeError = errors?.range;
  const range = timeRangeFromParts(parts);

  function change(field: keyof TimeRangeParts, value: string): void {
    const next = { ...parts, [field]: value };
    setParts(next);
    const updated = timeRangeFromParts(next);
    onChange?.(updated.startedAt, isTicking ? "" : updated.endedAt);
  }

  return (
    <div className="flex flex-col gap-5">
      <TextField
        label="Date"
        type="date"
        max={today}
        required
        invalid={rangeError !== undefined || errors?.startedAt !== undefined}
        value={parts.date}
        onChange={(event) => change("date", event.target.value)}
        onClick={openPicker}
        inputClassName="cursor-pointer"
      />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <TextField
          label="From"
          type="time"
          required
          invalid={rangeError !== undefined}
          error={errors?.startedAt}
          value={parts.startTime}
          onChange={(event) => change("startTime", event.target.value)}
          onClick={openPicker}
          inputClassName="cursor-pointer"
        />

        {isTicking ? (
          <p className="self-center text-sm text-slate-900/60">
            This timer is still running, so it has no end time yet — stop it
            to set one.
          </p>
        ) : (
          <TextField
            label="To"
            type="time"
            required
            error={errors?.endedAt ?? rangeError}
            hint={range.endsNextDay ? "Ends the next day." : undefined}
            value={parts.endTime}
            onChange={(event) => change("endTime", event.target.value)}
            onClick={openPicker}
            inputClassName="cursor-pointer"
          />
        )}
      </div>

      <input type="hidden" name="startedAt" value={range.startedAt} />
      {!isTicking && (
        <input type="hidden" name="endedAt" value={range.endedAt} />
      )}
    </div>
  );
}
