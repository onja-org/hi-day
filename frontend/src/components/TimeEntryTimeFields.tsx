"use client";

import { useEffect, useState } from "react";
import { clampDatetimeLocal } from "@/lib/clampDatetimeLocal";
import { toDatetimeLocalValue } from "@/lib/toDatetimeLocalValue";
import type { TimeEntryFieldErrors } from "@/lib/timeEntryFieldErrors";
import { DateAndTimeField } from "@/components/DateAndTimeField";

type TimeEntryTimeFieldsProps = {
  /** ISO instants, or undefined to leave the field empty. */
  startedAt?: string;
  endedAt?: string | null;
  /** The timer is still ticking, so there is no end to set yet. A *paused*
   * entry isn't this: it can be given an end, which closes it. */
  isTicking: boolean;
  /** Shown under whichever field is at fault — see `timeEntryFieldErrors`. */
  errors?: TimeEntryFieldErrors;
  /** Both current values, so the form can judge them as they are typed
   * rather than waiting for a submit to say what is wrong. */
  onChange?: (startedAt: string, endedAt: string) => void;
};

/** How often the cut-off catches up with the clock while the form is open. */
const NOW_REFRESH_MS = 30_000;

/** The Start and End inputs of the time-entry form.
 *
 * Each is a date plus a list of times rather than one `datetime-local`: a
 * native one cannot refuse a time of day, only a later date, so the times
 * that haven't happened are listed as disabled instead. */
export function TimeEntryTimeFields({
  startedAt,
  endedAt,
  isTicking,
  errors,
  onChange,
}: TimeEntryTimeFieldsProps) {
  const range = errors?.range;
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    // Fixed at mount, the cut-off would start refusing the real current
    // minute a few minutes into filling the form in.
    const handle = setInterval(() => setNow(new Date()), NOW_REFRESH_MS);
    return () => clearInterval(handle);
  }, []);

  const max = toDatetimeLocalValue(now.toISOString());
  const [start, setStart] = useState(() =>
    startedAt ? toDatetimeLocalValue(startedAt) : "",
  );
  const [end, setEnd] = useState(() =>
    endedAt ? toDatetimeLocalValue(endedAt) : "",
  );

  // A belt to the disabled options' braces: the date half is still a native
  // input, whose `max` greys out its calendar without stopping a later date
  // being typed into it.
  const startValue = clampDatetimeLocal(start, max);
  const endValue = clampDatetimeLocal(end, max);

  function change(field: "start" | "end"): (value: string) => void {
    return (raw) => {
      const value = clampDatetimeLocal(raw, max);
      if (field === "start") setStart(value);
      else setEnd(value);
      // The shown values, not the raw state: the untouched field may have
      // been pulled back by the clock since it was entered, and judging the
      // pair on a value no longer on screen would report a clash nobody can
      // see.
      onChange?.(
        field === "start" ? value : startValue,
        field === "end" ? value : endValue,
      );
    };
  }

  return (
    <div className="flex flex-col gap-5">
      <DateAndTimeField
        label="Start"
        name="startedAt"
        value={startValue}
        onChange={change("start")}
        maxDate={max.slice(0, 10)}
        now={now}
        error={errors?.startedAt}
        invalid={range !== undefined}
      />

      {isTicking ? (
        <p className="text-sm text-slate-900/60">
          This timer is still running, so it has no end time yet — pause or
          stop it to set one.
        </p>
      ) : (
        <DateAndTimeField
          label="End"
          name="endedAt"
          value={endValue}
          onChange={change("end")}
          maxDate={max.slice(0, 10)}
          now={now}
          error={errors?.endedAt ?? range}
        />
      )}
    </div>
  );
}
