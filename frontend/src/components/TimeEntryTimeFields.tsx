"use client";

import { toDatetimeLocalValue } from "@/lib/toDatetimeLocalValue";

type TimeEntryTimeFieldsProps = {
  /** ISO instants, or undefined to leave the input empty. */
  startedAt?: string;
  endedAt?: string | null;
  /** The timer is still ticking, so there is no end to set yet. A *paused*
   * entry isn't this: it can be given an end, which closes it. */
  isTicking: boolean;
};

const FIELD_CLASSES =
  "w-full rounded-md border border-input-border bg-white px-3 py-2 text-slate-900 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30";

/** The Start and End inputs of the time-entry form.
 *
 * Always stacked, never side by side: a datetime-local input's native width
 * doesn't shrink below its content, so two of them would overflow the
 * modal's max-w-lg even at sm: widths. */
export function TimeEntryTimeFields({
  startedAt,
  endedAt,
  isTicking,
}: TimeEntryTimeFieldsProps) {
  return (
    <div className="flex flex-col gap-5">
      <label className="flex flex-1 flex-col gap-1.5">
        Start
        <input
          name="startedAt"
          type="datetime-local"
          required
          defaultValue={startedAt ? toDatetimeLocalValue(startedAt) : undefined}
          className={FIELD_CLASSES}
        />
      </label>

      {isTicking ? (
        <p className="text-sm text-slate-900/60">
          This timer is still running, so it has no end time yet — pause or
          stop it to set one.
        </p>
      ) : (
        <label className="flex flex-1 flex-col gap-1.5">
          End
          <input
            name="endedAt"
            type="datetime-local"
            required
            defaultValue={endedAt ? toDatetimeLocalValue(endedAt) : undefined}
            className={FIELD_CLASSES}
          />
        </label>
      )}
    </div>
  );
}
