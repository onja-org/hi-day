"use client";

import { addDays, isBefore, startOfDay } from "date-fns";
import { DatePicker } from "@/components/DatePicker";
import { Label } from "@/components/ui/form/Label";
import { StepNavigator } from "@/components/StepNavigator";

type DayNavigatorProps = {
  value: Date;
  onChange: (date: Date) => void;
  label: string;
};

export function DayNavigator({ value, onChange, label }: DayNavigatorProps) {
  const isToday = !isBefore(startOfDay(value), startOfDay(new Date()));

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
        <DatePicker value={value} onChange={onChange} label={label} embedded />
      </StepNavigator>
    </div>
  );
}
