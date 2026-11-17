"use client";

import { addDays, isBefore, startOfDay } from "date-fns";
import { DatePicker } from "@/components/DatePicker";
import { Label } from "@/components/ui/form/Label";
import { StepNavigator } from "@/components/StepNavigator";

type DayNavigatorProps = {
  value: Date;
  onChange: (date: Date) => void;
  label: string;
  /** The last selectable day; the viewer's own today unless given. */
  today?: Date;
};

export function DayNavigator({ value, onChange, label, today = new Date() }: DayNavigatorProps) {
  const isToday = !isBefore(startOfDay(value), startOfDay(today));

  return (
    <div className="flex flex-col gap-1">
      <Label>{label}</Label>
      <StepNavigator
        previousLabel="Previous day"
        nextLabel="Next day"
        onPrevious={() => onChange(addDays(value, -1))}
        onNext={() => onChange(addDays(value, 1))}
        nextDisabled={isToday}
      >
        <DatePicker value={value} onChange={onChange} label={label} today={today} embedded />
      </StepNavigator>
    </div>
  );
}
