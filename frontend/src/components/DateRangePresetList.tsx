"use client";

import clsx from "clsx";
import type { DateRangePreset } from "@/types/dateRange";

export const DATE_RANGE_PRESET_LABELS: Record<DateRangePreset, string> = {
  today: "Today",
  yesterday: "Yesterday",
  last_7_days: "Last 7 days",
  last_week: "Last week",
  last_2_weeks: "Last 2 weeks",
  this_month: "This month",
  last_month: "Last month",
};

type DateRangePresetListProps = {
  value: DateRangePreset | null;
  onSelect: (preset: DateRangePreset) => void;
};

/** `DateRangePicker`'s quick-preset column. */
export function DateRangePresetList({ value, onSelect }: DateRangePresetListProps) {
  return (
    <ul className="grid grid-cols-2 gap-2 sm:grid-cols-1">
      {Object.entries(DATE_RANGE_PRESET_LABELS).map(([preset, label]) => (
        <li key={preset}>
          <button
            type="button"
            aria-pressed={value === preset}
            onClick={() => onSelect(preset as DateRangePreset)}
            className={clsx(
              "w-full cursor-pointer rounded-md border px-3 py-1.5 text-left text-sm font-medium transition-colors duration-150",
              value === preset && "border-primary bg-primary text-white",
              value !== preset && "border-input-border text-slate-900 hover:bg-cream",
            )}
          >
            {label}
          </button>
        </li>
      ))}
    </ul>
  );
}
