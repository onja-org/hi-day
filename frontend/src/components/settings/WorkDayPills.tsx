"use client";

import clsx from "clsx";
import { DAY_LABELS, DAYS_IN_WEEK_ORDER } from "@/lib/describeWorkDays";

type WorkDayPillsProps = {
  selected: number[];
  onToggle: (day: number) => void;
  /** Names the group for screen readers — there's no visible legend. */
  label: string;
};

/** The Mon–Sun row of round day toggles. */
export function WorkDayPills({ selected, onToggle, label }: WorkDayPillsProps) {
  return (
    <div role="group" aria-label={label} className="flex flex-wrap gap-2">
      {DAYS_IN_WEEK_ORDER.map((day) => {
        const isOn = selected.includes(day);
        return (
          <button
            key={day}
            type="button"
            aria-pressed={isOn}
            onClick={() => onToggle(day)}
            className={clsx(
              "flex size-10 cursor-pointer items-center justify-center rounded-full border-2 text-xs font-semibold transition-colors duration-150",
              isOn && "border-ink bg-primary text-white",
              !isOn && "border-input-border bg-white text-slate-900 hover:bg-cream",
            )}
          >
            {DAY_LABELS[day]}
          </button>
        );
      })}
    </div>
  );
}
