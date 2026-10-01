import clsx from "clsx";
import { Label } from "@/components/ui/form/Label";
import { SCHEDULE_DAYS } from "@/lib/scheduleOptions";

type ScheduleDayPickerProps = {
  selected: number[];
  onChange: (days: number[]) => void;
};

/** Seven round day buttons (Su–Sa) that toggle independently. */
export function ScheduleDayPicker({ selected, onChange }: ScheduleDayPickerProps) {
  return (
    <fieldset className="flex flex-col gap-1.5">
      <Label className="text-xs tracking-wide text-slate-900/60 uppercase">Delivery days *</Label>
      <div className="flex flex-wrap gap-2">
        {SCHEDULE_DAYS.map((day) => {
          const isOn = selected.includes(day.index);
          return (
            <button
              key={day.index}
              type="button"
              aria-pressed={isOn}
              aria-label={day.long}
              onClick={() =>
                onChange(isOn ? selected.filter((index) => index !== day.index) : [...selected, day.index])
              }
              className={clsx(
                "size-9 cursor-pointer rounded-full border text-xs font-medium transition-colors duration-150",
                isOn && "border-primary bg-primary text-white",
                !isOn && "border-input-border text-primary-dark hover:border-primary",
              )}
            >
              {day.short}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}
