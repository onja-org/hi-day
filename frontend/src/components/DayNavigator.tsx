"use client";

import { addDays, isBefore, startOfDay } from "date-fns";
import { DatePicker } from "./DatePicker";
import { StepNavigator } from "./StepNavigator";

type DayNavigatorProps = {
  value: Date;
  onChange: (date: Date) => void;
  /** Accessible name for the date field, e.g. "Activity day". */
  label: string;
};

/** Previous/next-day arrows around an embedded `DatePicker` — step one
 * day at a time or jump straight to any past day. Next is disabled on
 * today, since the calendar doesn't allow future days either. */
export function DayNavigator({ value, onChange, label }: DayNavigatorProps) {
  const isToday = !isBefore(startOfDay(value), startOfDay(new Date()));

  return (
    <StepNavigator
      previousLabel="Previous day"
      nextLabel="Next day"
      onPrevious={() => onChange(addDays(value, -1))}
      onNext={() => onChange(addDays(value, 1))}
      nextDisabled={isToday}
    >
      <DatePicker value={value} onChange={onChange} label={label} embedded />
    </StepNavigator>
  );
}
