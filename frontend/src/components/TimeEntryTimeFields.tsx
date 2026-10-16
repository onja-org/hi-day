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
  /** Both current values, so the form can judge them as they are picked. */
  onChange?: (startedAt: string, endedAt: string) => void;
};

/** How often the cut-off catches up with the clock while the form is open. */
const NOW_REFRESH_MS = 30_000;

/** The Start and End inputs of the time-entry form. */
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

  // The date half is still a native input, whose `max` does not stop a later
  // date being typed. Clamping on render also pulls back a value the passing
  // clock has left in the future.
  const startValue = clampDatetimeLocal(start, max);
  const endValue = clampDatetimeLocal(end, max);

  function change(field: "start" | "end"): (value: string) => void {
    return (raw) => {
      const value = clampDatetimeLocal(raw, max);
      if (field === "start") setStart(value);
      else setEnd(value);
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
          This timer is still running, so it has no end time yet — stop it
          to set one.
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
