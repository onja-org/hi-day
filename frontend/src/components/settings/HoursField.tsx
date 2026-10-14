"use client";

import clsx from "clsx";

type HoursFieldProps = {
  label: string;
  value: number | null;
  onChange: (value: number | null) => void;
  /** Shown in the grey suffix box: "hrs/wk", "hrs/day", "wk", "day". */
  unit: string;
  placeholder?: string;
  max?: number;
  compact?: boolean;
};

/**
 * A number with a unit welded to its right-hand edge, as the screenshot
 * has it. Empty means `null` — removed for a target, no limit for a
 * ceiling — which is why this doesn't fall back to 0.
 */
export function HoursField({
  label,
  value,
  onChange,
  unit,
  placeholder,
  max = 168,
  compact,
}: HoursFieldProps) {
  return (
    <div className="flex items-stretch">
      <input
        type="number"
        aria-label={label}
        min={0}
        max={max}
        value={value ?? ""}
        placeholder={placeholder}
        onChange={(event) =>
          onChange(event.target.value === "" ? null : Number(event.target.value))
        }
        className={clsx(
          "min-w-0 rounded-l-brand-sm border-2 border-r-0 border-ink bg-white px-3 text-slate-900 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30",
          compact ? "h-9 w-16 text-sm" : "h-11 w-full",
        )}
      />
      <span
        className={clsx(
          "flex shrink-0 items-center rounded-r-brand-sm border-2 border-ink bg-cream px-3 text-slate-900/70",
          compact ? "h-9 text-xs" : "h-11 text-sm",
        )}
      >
        {unit}
      </span>
    </div>
  );
}
