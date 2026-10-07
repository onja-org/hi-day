"use client";

import type { ReactNode } from "react";
import { formatClockTime } from "@/lib/formatClockTime";
import { timeOfDayOptions } from "@/lib/timeOfDayOptions";
import { SelectField } from "@/components/ui/form/SelectField";
import { TextField } from "@/components/ui/form/TextField";

type DateAndTimeFieldProps = {
  /** Names the pair, e.g. "Start" — each control captions itself under it. */
  label: string;
  /** Submitted as one `YYYY-MM-DDTHH:mm` value under this name. */
  name: string;
  value: string;
  onChange: (value: string) => void;
  /** Latest date that may be chosen, `YYYY-MM-DD`. */
  maxDate: string;
  now: Date;
  error?: ReactNode;
  invalid?: boolean;
};

/** Any date, only to render a `HH:mm` through the viewer's clock format. */
const LABEL_DATE = "2000-01-01T";

/**
 * A date and a time of day, submitted as one `datetime-local` value.
 *
 * Two controls rather than one native input, which cannot refuse a time of
 * day — only a later date. A list can disable the times that haven't
 * happened.
 */
export function DateAndTimeField({
  label,
  name,
  value,
  onChange,
  maxDate,
  now,
  error,
  invalid,
}: DateAndTimeFieldProps) {
  const [date = "", time = ""] = value.split("T");
  const options = timeOfDayOptions({
    date,
    now,
    include: time === "" ? undefined : time,
  });

  function change(nextDate: string, nextTime: string): void {
    onChange(nextDate === "" && nextTime === "" ? "" : `${nextDate}T${nextTime}`);
  }

  return (
    <div className="flex flex-col gap-1.5">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <TextField
          label={`${label} date`}
          type="date"
          max={maxDate}
          required
          invalid={invalid || error !== undefined}
          value={date}
          onChange={(event) => change(event.target.value, time)}
        />

        <SelectField
          label={`${label} time`}
          required
          invalid={invalid || error !== undefined}
          value={time}
          onChange={(event) => change(date, event.target.value)}
        >
          <option value="" disabled>
            Select…
          </option>
          {options.map((option) => (
            <option
              key={option.value}
              value={option.value}
              disabled={option.disabled}
            >
              {formatClockTime(`${LABEL_DATE}${option.value}`)}
            </option>
          ))}
        </SelectField>
      </div>

      {error && <span className="text-xs text-error">{error}</span>}

      <input type="hidden" name={name} value={value} />
    </div>
  );
}
